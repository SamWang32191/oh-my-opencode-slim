// AST-grep tools
export { ast_grep_replace, ast_grep_search } from './ast-grep';
export { createBackgroundTools } from './background';
// Grep tool (ripgrep-based)
export { grep } from './grep';
// Hashline edit tool
export {
  applyHashlineEdits,
  applyHashlineEditsWithReport,
  computeLegacyLineHash,
  computeLineHash,
  createHashlineEditTool,
  formatHashLine,
  formatHashLines,
  normalizeLineRef,
  parseLineRef,
  validateLineRef,
} from './hashline-edit';
export {
  lsp_diagnostics,
  lsp_find_references,
  lsp_goto_definition,
  lsp_rename,
  lspManager,
} from './lsp';
