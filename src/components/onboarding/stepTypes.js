// Step-type discriminator for Learning Center lessons.
//
// A lesson's `steps` array can interleave four kinds of step:
//   • tour     — the live-app spotlight walkthrough (OnboardingTour.jsx). This is
//                the ORIGINAL schema; every legacy step is a tour step.
//   • slide    — a teaching card rendered inside the LessonPlayer (markdown body).
//   • quiz     — a multiple-choice knowledge check.
//   • exercise — a free-text prompt the AI coach grades and gives pointers on.
//
// BACKWARD COMPATIBILITY (load-bearing): every existing step lacks a `type`, so
// `stepType()` MUST default to 'tour'. Never read `step.type` directly anywhere
// else — always go through stepType() so the default stays in one place.

export const STEP_TYPES = {
    TOUR: 'tour',
    SLIDE: 'slide',
    QUIZ: 'quiz',
    EXERCISE: 'exercise',
};

export function stepType(step) {
    return step?.type || STEP_TYPES.TOUR;
}

export function isTourStep(step) {
    return stepType(step) === STEP_TYPES.TOUR;
}

export function isInlineStep(step) {
    // Anything the LessonPlayer renders itself (vs handing off to the engine).
    return !isTourStep(step);
}

// A step the learner must complete before advancing (vs an optional one they can
// skip). Slides are always satisfiable; quizzes/exercises gate on a pass unless
// explicitly `optional`. Tour steps follow the engine's own optional handling.
export function stepIsRequired(step) {
    return !step?.optional;
}
