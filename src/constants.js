
export const LOG_INFO = 0;
export const LOG_WARN = 1;
export const LOG_ERROR = 2;
export const LOG_FATAL = 3;

export const LOG_LEVEL_TO_STRING = {
    LOG_INFO  : 'I',
    LOG_WARN  : 'W',
    LOG_ERROR : 'E',
    LOG_FATAL : 'F',
};

// The report interval for empty reports used to sample the clock skew
export const CLOCK_STATE_REFRESH_INTERVAL_MS = 350;
