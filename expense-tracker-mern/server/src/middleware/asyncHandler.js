// Express 4 does not automatically forward rejected async route promises to error middleware.
export const asyncHandler = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
