/**
 * editorFacade.js — a TipTap-shaped facade over an EditorView, returned by
 * BeeEditor's getEditor(). It implements only the surface the call sites and the
 * ported toolbar actually use (grep-confirmed): chain / isActive / getAttributes
 * / can / getHTML / getText / state / commands.setContent / storage.markdown.
 */
import { contentToDoc } from './contentPipeline.js';
import { astToHtml } from '../serialization/astToHtml.js';
import { markdownToAst } from '../serialization/mdToAst.js';

export function makeFacade(view) {
  return {
    chain: () => view.chain(),
    can: () => view.can(),
    isActive: (name, attrs) => view.isActive(name, attrs),
    getAttributes: (name) => view.getAttributes(name),
    getHTML: () => view.getHTML(),
    getText: () => view.getText(),
    getMarkdown: () => view.getMarkdown(),
    get state() { return view.state; },
    get isEditable() { return view.editable; },
    focus: () => { view.focus(); return makeFacade(view); },
    commands: {
      setContent: (content, emitUpdate = false) => view.setDoc(contentToDoc(content), { emitUpdate: emitUpdate === true }),
      focus: () => view.focus(),
    },
    storage: {
      markdown: {
        getMarkdown: () => view.getMarkdown(),
        parser: { parse: (md) => astToHtml(markdownToAst(md || '')) },
      },
    },
    view: { dom: view.host },
    _view: view,
  };
}
