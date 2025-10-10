export const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler = (err, req, res, next) => {
  console.error("[ERROR]", err?.stack || err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    // only show stack on dev
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
