import { toast } from '../components/shared/Toast';

/**
 * Access the app toast API from components. The toast system is event-based, so
 * this returns the singleton `toast` (`toast.success/error/info/dismiss`) — a
 * hook for ergonomic parity with the rest of hooks/, and a single import site to
 * swap if it ever grows a context.
 */
export default function useToast() {
    return toast;
}
