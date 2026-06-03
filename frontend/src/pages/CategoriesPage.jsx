import { Link } from "react-router-dom";
import Layout from "../layouts/Layout";
import { mockBooks } from "../utils/mockBooks";

const categories = [...new Set(mockBooks.map((book) => book.category))].map(
  (category) => ({
    name: category,
    count: mockBooks.filter((book) => book.category === category).length,
  }),
);

function CategoriesPage() {
  return (
    <Layout>
      <section className="page-section">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Danh mục sách</p>
            <h1>Thể loại</h1>
            <span>Khám phá sách theo từng nhóm chủ đề trong Readora.</span>
          </div>

          <div className="book-grid">
            {categories.map((category) => (
              <article className="book-card" key={category.name}>
                <div className="book-card__content">
                  <p className="book-card__category">Thể loại</p>
                  <h3>{category.name}</h3>
                  <p className="book-card__description">
                    {category.count} cuốn sách đang có trong danh mục này.
                  </p>
                  <div className="book-card__footer">
                    <strong>{category.count} sách</strong>
                    <Link className="book-card__button" to="/books">
                      Xem sách
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default CategoriesPage;
