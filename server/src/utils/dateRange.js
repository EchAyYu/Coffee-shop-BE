// src/utils/dateRange.js

// 🔹 Hôm nay: [00:00:00, 23:59:59]
export const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// 🔹 7 ngày / N ngày gần đây (tính cả hôm nay)
export const getPastDaysRange = (days = 7) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// 🔹 Tuần hiện tại (thứ 2 → CN)
export const getCurrentWeekRange = () => {
  const now = new Date();

  const start = new Date(now);
  const day = start.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // về thứ 2
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// 🔹 Tháng hiện tại
export const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// 🔹 Năm hiện tại
export const getCurrentYearRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};
