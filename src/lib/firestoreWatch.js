import { onSnapshot } from './firebase';
import { createLogger } from './logger';

const watchLogger = createLogger('firestoreWatch');
const errorOnceCache = new Set();

const getErrorCode = (error) => String(error?.code || 'unknown');
const getErrorMessage = (error) => String(error?.message || 'unknown Firestore listener error');
const toErrorSignature = (label, error) => `${label}:${getErrorCode(error)}:${getErrorMessage(error)}`;

export const isMissingIndexError = (error) => getErrorCode(error) === 'failed-precondition';
export const isPermissionDeniedError = (error) => getErrorCode(error) === 'permission-denied';

export const resetFirestoreWatchErrorCache = () => {
    errorOnceCache.clear();
};

export const watchQuerySnapshot = (queryRef, onNext, options = {}) => {
    const {
        label = 'watch',
        onFallback,
        onError
    } = options;

    return onSnapshot(
        queryRef,
        (snapshot) => {
            if (typeof onNext === 'function') onNext(snapshot);
        },
        (error) => {
            const signature = toErrorSignature(label, error);
            if (!errorOnceCache.has(signature)) {
                errorOnceCache.add(signature);
                watchLogger.warn(
                    `${label} listener failed`,
                    {
                        code: getErrorCode(error),
                        message: getErrorMessage(error),
                        missingIndex: isMissingIndexError(error),
                        permissionDenied: isPermissionDeniedError(error)
                    }
                );
            }
            if (typeof onFallback === 'function') {
                try {
                    onFallback(error);
                } catch (fallbackError) {
                    watchLogger.error(`${label} fallback failed`, fallbackError);
                }
            }
            if (typeof onError === 'function') {
                try {
                    onError(error);
                } catch (handlerError) {
                    watchLogger.error(`${label} error handler failed`, handlerError);
                }
            }
        }
    );
};

