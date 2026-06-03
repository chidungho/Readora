const createBookCover = ({ lines, author, background, accent }) => {
  const titleLines = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 42;
      return `<tspan x="36" dy="${dy}">${line}</tspan>`;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="460" viewBox="0 0 320 460">
      <rect width="320" height="460" rx="18" fill="${background}" />
      <rect x="24" y="24" width="272" height="412" rx="12" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="2" />
      <rect x="36" y="326" width="118" height="8" rx="4" fill="${accent}" />
      <rect x="36" y="350" width="186" height="4" rx="2" fill="rgba(255,255,255,0.5)" />
      <text x="36" y="96" fill="#fffdf9" font-family="Georgia, serif" font-size="34" font-weight="700">${titleLines}</text>
      <text x="36" y="398" fill="#fffdf9" font-family="Arial, sans-serif" font-size="18">${author}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const mockBooks = [
  {
    id: 1,
    title: "Dòng Sông Ký Ức",
    author: "Minh An",
    description: "Một tiểu thuyết ấm áp về gia đình, tuổi trẻ và những lựa chọn khó quên.",
    price: 129000,
    image: createBookCover({
      lines: ["Dòng sông", "ký ức"],
      author: "Minh An",
      background: "#4D7C0F",
      accent: "#E9C46A",
    }),
    category: "Tiểu thuyết",
    condition: "Sách mới",
    publishedAt: "2026-05-08",
    sold: 420,
    stock: 18,
    rating: 4.8,
  },
  {
    id: 2,
    title: "Nghệ Thuật Tập Trung",
    author: "Lê Hoàng",
    description: "Những phương pháp thực tế giúp bạn đọc, học và làm việc sâu hơn mỗi ngày.",
    price: 98000,
    image: createBookCover({
      lines: ["Nghệ thuật", "tập trung"],
      author: "Lê Hoàng",
      background: "#334155",
      accent: "#84CC16",
    }),
    category: "Kinh doanh",
    condition: "Sách mới",
    publishedAt: "2026-04-19",
    sold: 360,
    stock: 24,
    rating: 4.6,
  },
  {
    id: 3,
    title: "Bếp Nhỏ Mùa Đông",
    author: "Hạ Vy",
    description: "Tản văn dịu dàng về những bữa cơm nhà, thành phố cũ và mùi bánh mới ra lò.",
    price: 115000,
    image: createBookCover({
      lines: ["Bếp nhỏ", "mùa đông"],
      author: "Hạ Vy",
      background: "#9A3412",
      accent: "#F4A261",
    }),
    category: "Sức khỏe",
    condition: "Sách cũ",
    publishedAt: "2025-12-02",
    sold: 214,
    stock: 12,
    rating: 4.7,
  },
  {
    id: 4,
    title: "Vũ Trụ Trong Túi Áo",
    author: "Quang Phạm",
    description: "Cuốn nhập môn khoa học dễ đọc cho người tò mò về bầu trời và các vì sao.",
    price: 142000,
    image: createBookCover({
      lines: ["Vũ trụ", "trong túi áo"],
      author: "Quang Phạm",
      background: "#0F766E",
      accent: "#FACC15",
    }),
    category: "Giáo dục",
    condition: "Sách mới",
    publishedAt: "2026-05-21",
    sold: 510,
    stock: 9,
    rating: 4.9,
  },
  {
    id: 5,
    title: "Khu Vườn Mùa Hè",
    author: "An Nhiên",
    description: "Một câu chuyện thiếu nhi trong trẻo về tình bạn, lòng can đảm và trí tưởng tượng.",
    price: 89000,
    image: createBookCover({
      lines: ["Khu vườn", "mùa hè"],
      author: "An Nhiên",
      background: "#B45309",
      accent: "#FACC15",
    }),
    category: "Thiếu nhi",
    condition: "Sách mới",
    publishedAt: "2026-03-14",
    sold: 288,
    stock: 30,
    rating: 4.5,
  },
  {
    id: 6,
    title: "Code Sạch Cho Người Mới",
    author: "Hoàng Nam",
    description: "Các nguyên tắc lập trình dễ hiểu, có ví dụ gần gũi cho người bắt đầu.",
    price: 168000,
    image: createBookCover({
      lines: ["Code sạch", "cho người mới"],
      author: "Hoàng Nam",
      background: "#102330",
      accent: "#22D3EE",
    }),
    category: "Công nghệ",
    condition: "Sách mới",
    publishedAt: "2026-05-28",
    sold: 192,
    stock: 16,
    rating: 4.4,
  },
  {
    id: 7,
    title: "Quán Cà Phê Khởi Nghiệp",
    author: "Mai Chi",
    description: "Ghi chép thực tế về cách biến một ý tưởng nhỏ thành mô hình kinh doanh bền vững.",
    price: 138000,
    image: createBookCover({
      lines: ["Quán cà phê", "khởi nghiệp"],
      author: "Mai Chi",
      background: "#7C2D12",
      accent: "#FDBA74",
    }),
    category: "Kinh doanh",
    condition: "Sách cũ",
    publishedAt: "2025-10-10",
    sold: 342,
    stock: 7,
    rating: 4.2,
  },
  {
    id: 8,
    title: "Mùa Hè Của Na",
    author: "Bảo Trâm",
    description: "Một cuốn đọc ngắn cho trẻ em với nhịp kể vui, nhẹ và giàu hình ảnh.",
    price: 76000,
    image: createBookCover({
      lines: ["Mùa hè", "của Na"],
      author: "Bảo Trâm",
      background: "#D97706",
      accent: "#7C6A0A",
    }),
    category: "Thiếu nhi",
    condition: "Sách cũ",
    publishedAt: "2025-08-18",
    sold: 156,
    stock: 11,
    rating: 4.1,
  },
  {
    id: 9,
    title: "Sức Bền Tinh Thần",
    author: "Phương Linh",
    description: "Những bài thực hành nhỏ giúp bạn nghỉ ngơi tốt hơn và giữ nhịp sống cân bằng.",
    price: 124000,
    image: createBookCover({
      lines: ["Sức bền", "tinh thần"],
      author: "Phương Linh",
      background: "#556B2F",
      accent: "#E9C46A",
    }),
    category: "Sức khỏe",
    condition: "Sách mới",
    publishedAt: "2026-01-22",
    sold: 305,
    stock: 20,
    rating: 4.6,
  },
  {
    id: 10,
    title: "Lớp Học Dưới Hiên",
    author: "Thanh Tùng",
    description: "Tập truyện giáo dục truyền cảm hứng học tập bằng những tình huống đời thường.",
    price: 102000,
    image: createBookCover({
      lines: ["Lớp học", "dưới hiên"],
      author: "Thanh Tùng",
      background: "#4B5563",
      accent: "#14B8A6",
    }),
    category: "Giáo dục",
    condition: "Sách mới",
    publishedAt: "2026-02-09",
    sold: 230,
    stock: 14,
    rating: 4.3,
  },
];
