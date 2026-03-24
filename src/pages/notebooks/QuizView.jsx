import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy, ArrowRight } from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

/* ── Parse quiz content into structured questions ── */
function parseQuiz(content) {
    if (!content) return { questions: [], answerKey: {} };

    // Split the content to find the Answer Key
    const answerKeyMatch = content.match(/(?:^|\n)#+?\s*(?:Answer\s*Key|Answers|Correct\s*Answers)[:\s]*([\s\S]*?)$/i);
    const answerKey = {};

    if (answerKeyMatch) {
        // Parse answer key: "1. A" or "1: A" or "Q1: A" etc.
        const keyLines = answerKeyMatch[1].split('\n');
        for (const line of keyLines) {
            const m = line.match(/(?:Q?\s*)?(\d+)[.):\s-]+\s*([A-Da-d])/);
            if (m) {
                answerKey[parseInt(m[1])] = m[2].toUpperCase();
            }
        }
    }

    // Remove answer key section from content for question parsing
    const questionContent = answerKeyMatch
        ? content.slice(0, content.indexOf(answerKeyMatch[0]))
        : content;

    // Parse questions
    const questions = [];
    // Split by question pattern: "1." or "**1.**" or "### Question 1" etc.
    const qBlocks = questionContent.split(/(?:^|\n)(?:#{1,3}\s*)?(?:\*\*)?(?:Question\s+)?(\d+)[.):\s]+(?:\*\*)?/i);

    // qBlocks: [preamble, num1, block1, num2, block2, ...]
    for (let i = 1; i < qBlocks.length; i += 2) {
        const qNum = parseInt(qBlocks[i]);
        const block = (qBlocks[i + 1] || '').trim();

        if (!block) continue;

        // Extract question text and options
        const lines = block.split('\n');
        let questionText = '';
        const options = [];

        for (const line of lines) {
            const optMatch = line.match(/^\s*(?:[-*])?\s*\**([A-Da-d])[.):\s]+\**\s*(.+)/);
            if (optMatch) {
                options.push({
                    letter: optMatch[1].toUpperCase(),
                    text: optMatch[2].replace(/\*\*/g, '').trim(),
                });
            } else if (options.length === 0) {
                // Still in question text
                questionText += (questionText ? '\n' : '') + line;
            }
        }

        if (questionText.trim() && options.length > 0) {
            questions.push({
                num: qNum,
                text: questionText.replace(/\*\*/g, '').trim(),
                options,
                correctAnswer: answerKey[qNum] || null,
            });
        }
    }

    return { questions, answerKey };
}

/* ─────────────────────────────────────────────────── */
/*  QuizView                                           */
/* ─────────────────────────────────────────────────── */
export default function QuizView({ content }) {
    const { questions } = useMemo(() => parseQuiz(content), [content]);
    const [currentQ, setCurrentQ] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [showResult, setShowResult] = useState({});
    const [quizFinished, setQuizFinished] = useState(false);

    // Fallback if parsing fails
    if (questions.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-8 py-8 prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer content={content} />
            </div>
        );
    }

    const q = questions[currentQ];
    const totalQuestions = questions.length;
    const answeredCount = Object.keys(selectedAnswers).length;

    const selectAnswer = (letter) => {
        if (showResult[currentQ]) return; // Already submitted
        setSelectedAnswers(prev => ({ ...prev, [currentQ]: letter }));
    };

    const checkAnswer = () => {
        setShowResult(prev => ({ ...prev, [currentQ]: true }));
    };

    const nextQuestion = () => {
        if (currentQ < totalQuestions - 1) {
            setCurrentQ(currentQ + 1);
        } else {
            setQuizFinished(true);
        }
    };

    const resetQuiz = () => {
        setCurrentQ(0);
        setSelectedAnswers({});
        setShowResult({});
        setQuizFinished(false);
    };

    // Calculate score
    const score = useMemo(() => {
        let correct = 0;
        for (const [idx, answer] of Object.entries(selectedAnswers)) {
            const question = questions[parseInt(idx)];
            if (question?.correctAnswer && answer === question.correctAnswer) {
                correct++;
            }
        }
        return correct;
    }, [selectedAnswers, questions, quizFinished]);

    // ── Results screen ──
    if (quizFinished) {
        const percentage = Math.round((score / totalQuestions) * 100);
        const getGrade = () => {
            if (percentage >= 90) return { emoji: '🏆', text: 'Excellent!', color: '#22c55e' };
            if (percentage >= 70) return { emoji: '🎉', text: 'Great Job!', color: '#3b82f6' };
            if (percentage >= 50) return { emoji: '👍', text: 'Good Effort!', color: '#f59e0b' };
            return { emoji: '📚', text: 'Keep Studying!', color: '#ef4444' };
        };
        const grade = getGrade();

        return (
            <div className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center text-center">
                <div className="text-6xl mb-4">{grade.emoji}</div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{grade.text}</h2>
                <p className="text-base mb-6" style={{ color: 'var(--text-secondary)' }}>
                    You scored <strong style={{ color: grade.color }}>{score}</strong> out of <strong>{totalQuestions}</strong> ({percentage}%)
                </p>

                {/* Results breakdown */}
                <div className="w-full space-y-2 mb-8">
                    {questions.map((question, idx) => {
                        const userAnswer = selectedAnswers[idx];
                        const isCorrect = userAnswer === question.correctAnswer;
                        return (
                            <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left"
                                style={{
                                    borderColor: isCorrect ? '#22c55e40' : '#ef444440',
                                    background: isCorrect ? '#22c55e08' : '#ef444408',
                                }}>
                                {isCorrect
                                    ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#22c55e' }} />
                                    : <XCircle className="w-5 h-5 shrink-0" style={{ color: '#ef4444' }} />
                                }
                                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                                    Q{idx + 1}: {question.text.slice(0, 80)}{question.text.length > 80 ? '…' : ''}
                                </span>
                                <span className="text-xs font-mono shrink-0" style={{ color: isCorrect ? '#22c55e' : '#ef4444' }}>
                                    {userAnswer}{!isCorrect && question.correctAnswer && ` → ${question.correctAnswer}`}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <button onClick={resetQuiz}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                    <RotateCcw className="w-4 h-4" />
                    Retry Quiz
                </button>
            </div>
        );
    }

    // ── Question screen ──
    const isAnswered = selectedAnswers[currentQ] !== undefined;
    const isChecked = showResult[currentQ] === true;
    const isCorrect = isChecked && selectedAnswers[currentQ] === q.correctAnswer;

    return (
        <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        Question {currentQ + 1} of {totalQuestions}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        {answeredCount} answered
                    </span>
                </div>
                <div className="flex gap-1">
                    {questions.map((_, idx) => (
                        <div
                            key={idx}
                            className="h-1.5 flex-1 rounded-full transition-all cursor-pointer"
                            onClick={() => { setCurrentQ(idx); }}
                            style={{
                                background: idx === currentQ
                                    ? 'var(--accent-primary)'
                                    : showResult[idx] !== undefined
                                        ? selectedAnswers[idx] === questions[idx].correctAnswer
                                            ? '#22c55e'
                                            : '#ef4444'
                                        : 'var(--bg-tertiary)',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Question Card */}
            <div className="rounded-2xl border p-6 mb-6"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: 'var(--accent-primary)' }}>
                    Question {currentQ + 1}
                </div>
                <div className="text-base font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    <MarkdownRenderer content={q.text} />
                </div>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
                {q.options.map((opt) => {
                    const isSelected = selectedAnswers[currentQ] === opt.letter;
                    const isCorrectOption = isChecked && opt.letter === q.correctAnswer;
                    const isWrongSelected = isChecked && isSelected && !isCorrectOption;

                    let borderColor = 'var(--border-subtle)';
                    let bgColor = 'var(--bg-secondary)';
                    let badgeColor = 'var(--bg-tertiary)';
                    let badgeText = 'var(--text-secondary)';

                    if (isCorrectOption) {
                        borderColor = '#22c55e';
                        bgColor = '#22c55e08';
                        badgeColor = '#22c55e';
                        badgeText = '#ffffff';
                    } else if (isWrongSelected) {
                        borderColor = '#ef4444';
                        bgColor = '#ef444408';
                        badgeColor = '#ef4444';
                        badgeText = '#ffffff';
                    } else if (isSelected && !isChecked) {
                        borderColor = 'var(--accent-primary)';
                        bgColor = 'var(--accent-primary)08';
                        badgeColor = 'var(--accent-primary)';
                        badgeText = '#ffffff';
                    }

                    return (
                        <button
                            key={opt.letter}
                            onClick={() => selectAnswer(opt.letter)}
                            disabled={isChecked}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all hover:border-[var(--accent-primary)]"
                            style={{
                                borderColor,
                                background: bgColor,
                                opacity: isChecked && !isSelected && !isCorrectOption ? 0.5 : 1,
                            }}
                        >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                                style={{ background: badgeColor, color: badgeText }}>
                                {isCorrectOption ? '✓' : isWrongSelected ? '✗' : opt.letter}
                            </div>
                            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                                {opt.text}
                            </span>
                            {isCorrectOption && (
                                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#22c55e' }} />
                            )}
                            {isWrongSelected && (
                                <XCircle className="w-5 h-5 shrink-0" style={{ color: '#ef4444' }} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <button
                    onClick={resetQuiz}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    Restart
                </button>

                <div className="flex gap-2">
                    {isAnswered && !isChecked && q.correctAnswer && (
                        <button
                            onClick={checkAnswer}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))' }}
                        >
                            Check Answer
                        </button>
                    )}
                    {isAnswered && !isChecked && !q.correctAnswer && (
                        <button onClick={nextQuestion}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))' }}>
                            {currentQ < totalQuestions - 1 ? 'Next' : 'Finish'}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                    {isChecked && (
                        <button onClick={nextQuestion}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                            style={{ background: isCorrect
                                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                : 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))'
                            }}>
                            {currentQ < totalQuestions - 1 ? 'Next Question' : 'See Results'}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
