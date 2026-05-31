export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: "info", message, ...context, at: new Date().toISOString() }));
  },
  error: (message: string, context?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "error", message, ...context, at: new Date().toISOString() }));
  }
};

