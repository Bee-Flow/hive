// Moved to components/shared/useConfirm so every Studio surface can share one
// in-app confirm instead of falling back to window.confirm. Re-exported here
// because the CMS builder imports it by this path in several places.
export { default } from '../../../shared/useConfirm';
