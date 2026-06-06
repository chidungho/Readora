import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { FALLBACK_COVER_IMAGE, getAdminStats } from "../services/api";
import { socket } from "../services/socket";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const emptyStats = {
  totalBooks: 0,
  totalOrders: 0,
  pendingOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  totalRevenueDelivered: 0,
  totalRevenuePaid: 0,
  todayOrders: 0,
  todayRevenue: 0,
  recentOrders: [],
  topSellingBooks: [],
  lowStockBooks: [],
  revenueByDay: [],
};

const statusLabels = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(number);
};

const formatDayLabel = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const formatDateTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Đang cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function AdminDashboardPage() {
  const { user } = useOutletContext();
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback(async (options = {}) => {
    const showInitialLoading = !options.silent;

    if (!showInitialLoading) {
      setRefreshing(true);
    }

    try {
      const nextStats = await getAdminStats({ signal: options.signal });
      setStats({ ...emptyStats, ...nextStats });
      setError("");
    } catch (dashboardError) {
      if (dashboardError.name !== "AbortError") {
        setError(dashboardError.message || "Không thể tải tổng quan quản trị.");
      }
    } finally {
      if (showInitialLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getAdminStats({ signal: controller.signal })
      .then((nextStats) => {
        setStats({ ...emptyStats, ...nextStats });
        setError("");
      })
      .catch((dashboardError) => {
        if (dashboardError.name !== "AbortError") {
          setError(dashboardError.message || "Không thể tải tổng quan quản trị.");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const reloadStats = () => {
      loadStats({ silent: true });
    };

    socket.connect();
    socket.on("admin:new-order", reloadStats);
    socket.on("admin:order-updated", reloadStats);

    return () => {
      socket.off("admin:new-order", reloadStats);
      socket.off("admin:order-updated", reloadStats);
    };
  }, [loadStats]);

  const chartData = useMemo(() => ({
    labels: stats.revenueByDay.map((item) => formatDayLabel(item.day)),
    datasets: [
      {
        label: "Doanh thu đã giao",
        data: stats.revenueByDay.map((item) => Number(item.revenue || 0)),
        backgroundColor: "rgba(154, 52, 18, 0.72)",
        borderRadius: 10,
      },
    ],
  }), [stats.revenueByDay]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => formatCurrency(context.parsed.y),
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value),
        },
      },
    },
  }), []);

  const cards = [
    { label: "Tổng sách", value: stats.totalBooks },
    { label: "Tổng đơn", value: stats.totalOrders },
    { label: "Đơn chờ xác nhận", value: stats.pendingOrders },
    {
      label: "Doanh thu đã giao",
      value: formatCurrency(stats.totalRevenueDelivered),
      isCurrency: true,
    },
    {
      label: "Doanh thu hôm nay",
      value: formatCurrency(stats.todayRevenue),
      isCurrency: true,
    },
    { label: "Đơn hôm nay", value: stats.todayOrders },
  ];

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header">
        <div>
          <p className="eyebrow">TỔNG QUAN</p>
          <h1>Xin chào, {user.name || "Admin"}</h1>
          <p>Quản lý nhanh tình hình kinh doanh của Readora trong một màn hình.</p>
        </div>
        <div className="admin-page__actions">
          {refreshing && <span className="admin-refreshing">Đang cập nhật...</span>}
          <Link className="button button--secondary" to="/admin/orders">
            Xem đơn hàng
          </Link>
          <Link className="button button--primary" to="/admin/books">
            Thêm sách
          </Link>
        </div>
      </div>

      {loading && <p className="state-message">Đang tải tổng quan...</p>}
      {!loading && error && <p className="state-message state-message--error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="admin-stats admin-stats--dashboard">
            {cards.map((card) => (
              <article
                className={`admin-stat${card.isCurrency ? " admin-stat--currency" : ""}`}
                key={card.label}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <section className="admin-panel admin-chart-panel">
            <div className="admin-panel__header">
              <div>
                <p className="eyebrow">7 NGÀY GẦN NHẤT</p>
                <h2>Doanh thu theo ngày</h2>
              </div>
              <span>{formatCurrency(stats.totalRevenuePaid)} đã thanh toán</span>
            </div>
            <div className="admin-revenue-chart">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </section>

          <div className="admin-dashboard-grid">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <p className="eyebrow">GẦN ĐÂY</p>
                  <h2>Đơn hàng mới</h2>
                </div>
                <Link to="/admin/orders">Xem tất cả</Link>
              </div>
              {stats.recentOrders.length === 0 ? (
                <p className="state-message">Chưa có đơn hàng.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--compact">
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Khách hàng</th>
                        <th>Trạng thái</th>
                        <th>Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.map((order) => (
                        <tr key={order._id}>
                          <td>
                            <strong>#{order.orderCode || String(order._id).slice(-8).toUpperCase()}</strong>
                            <span>{formatDateTime(order.createdAt)}</span>
                          </td>
                          <td>{order.user?.name || order.user?.email || "Khách hàng"}</td>
                          <td>
                            <span className={`admin-status admin-status--${order.status}`}>
                              {statusLabels[order.status] || order.status}
                            </span>
                          </td>
                          <td>{formatCurrency(order.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="admin-dashboard-side">
              <section className="admin-panel">
                <div className="admin-panel__header">
                  <div>
                    <p className="eyebrow">BÁN CHẠY</p>
                  <h2>Sách bán chạy</h2>
                </div>
              </div>
              {stats.topSellingBooks.length === 0 ? (
                <p className="state-message">Chưa có dữ liệu bán chạy.</p>
              ) : (
                <div className="admin-book-list">
                  {stats.topSellingBooks.map((book) => (
                    <article className="admin-book-metric" key={book._id || book.title}>
                      <img src={book.coverImage || FALLBACK_COVER_IMAGE} alt={`Bìa sách ${book.title}`} onError={(event) => { event.currentTarget.src = FALLBACK_COVER_IMAGE; }} />
                      <div>
                        <strong>{book.title}</strong>
                        <span>{book.author || "Chưa rõ tác giả"}</span>
                      </div>
                      <b>{Number(book.totalSold || book.sold || 0)} đã bán</b>
                    </article>
                  ))}
                </div>
              )}
              </section>

              <section className="admin-panel">
                <div className="admin-panel__header">
                  <div>
                    <p className="eyebrow">CẢNH BÁO</p>
                  <h2>Sách sắp hết hàng</h2>
                </div>
              </div>
              {stats.lowStockBooks.length === 0 ? (
                <p className="state-message">Không có sách sắp hết hàng.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--compact">
                    <thead>
                      <tr>
                        <th>Sách</th>
                        <th>Tồn kho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.lowStockBooks.map((book) => (
                        <tr key={book._id}>
                          <td>
                            <strong>{book.title}</strong>
                            <span>{book.author || "Chưa rõ tác giả"}</span>
                          </td>
                          <td>
                            <span className="admin-status admin-status--low-stock">
                              {Number(book.stock || 0)} cuốn
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </section>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminDashboardPage;
