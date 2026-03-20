const express = require("express");

function buildCompanyUrl({ baseDomain, subdomain }) {
  if (!baseDomain) return "#";
  const scheme = process.env.PUBLIC_SCHEME || "https";
  return `${scheme}://${subdomain}.${baseDomain}/`;
}

module.exports = function publicRoutes({ db }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const categories = db
      .prepare("SELECT * FROM categories ORDER BY sort ASC, name ASC")
      .all();

    if (!req.subdomain) {
      return res.render("index", {
        categories,
        baseDomain: process.env.BASE_DOMAIN || "",
        netraPhone: process.env.CALL_CENTER_PHONE || "",
        netraEmail: process.env.NETRA_EMAIL || "",
        netraAddress: process.env.NETRA_ADDRESS || "",
      });
    }

    const company = db
      .prepare(
        `
        SELECT c.*, cat.id AS category_id, cat.slug AS category_slug, cat.name AS category_name
        FROM companies c
        LEFT JOIN categories cat ON cat.id = c.category_id
        WHERE c.subdomain = ?
        `
      )
      .get(req.subdomain);

    if (!company) {
      res.status(404);
      return res.render("not_found", { subdomain: req.subdomain });
    }

    return res.render("company", {
      company,
      category: company.category_id ? { slug: company.category_slug, name: company.category_name } : null,
      baseDomain: process.env.BASE_DOMAIN || "",
      companyUrl: buildCompanyUrl({ baseDomain: process.env.BASE_DOMAIN || "", subdomain: company.subdomain }),
      netraPhone: process.env.CALL_CENTER_PHONE || "",
      netraEmail: process.env.NETRA_EMAIL || "",
      netraAddress: process.env.NETRA_ADDRESS || "",
    });
  });

  router.get("/directory", async (req, res) => {
    const categories = db
      .prepare("SELECT * FROM categories ORDER BY sort ASC, name ASC")
      .all();

    const selected = req.query.category ? String(req.query.category) : null;

    let companies = [];
    if (selected) {
      companies = db
        .prepare(
          `
          SELECT c.*
          FROM companies c
          INNER JOIN categories cat ON cat.id = c.category_id
          WHERE cat.slug = ?
          ORDER BY c.name ASC
          `
        )
        .all(selected);
    } else {
      // Small default set for landing-style browsing.
      companies = db.prepare("SELECT * FROM companies ORDER BY updated_at DESC LIMIT 24").all();
    }

    return res.render("directory", {
      categories,
      selectedCategory: selected,
      companies,
      baseDomain: process.env.BASE_DOMAIN || "",
      buildCompanyUrl,
      netraPhone: process.env.CALL_CENTER_PHONE || "",
      netraEmail: process.env.NETRA_EMAIL || "",
      netraAddress: process.env.NETRA_ADDRESS || "",
    });
  });

  router.get("/category/:categorySlug", async (req, res) => {
    const categorySlug = req.params.categorySlug;
    const category = db.prepare("SELECT * FROM categories WHERE slug = ?").get(categorySlug);
    if (!category) {
      res.status(404);
      return res.render("not_found", { slug: categorySlug, kind: "category" });
    }

    const companies = db
      .prepare(
        `
        SELECT *
        FROM companies
        WHERE category_id = ?
        ORDER BY name ASC
        `
      )
      .all(category.id);

    const categories = db
      .prepare("SELECT * FROM categories ORDER BY sort ASC, name ASC")
      .all();

    return res.render("category", {
      category,
      categories,
      companies,
      baseDomain: process.env.BASE_DOMAIN || "",
      buildCompanyUrl,
      netraPhone: process.env.CALL_CENTER_PHONE || "",
      netraEmail: process.env.NETRA_EMAIL || "",
      netraAddress: process.env.NETRA_ADDRESS || "",
    });
  });

  return router;
};

