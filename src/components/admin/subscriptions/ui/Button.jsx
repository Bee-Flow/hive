// The canonical Button now lives in components/shared/Button. This path is kept
// as a thin re-export so existing admin/subscriptions consumers keep working
// while the parallel UI kit is migrated to the shared kit.
export { Button, default } from '../../../shared/Button';
