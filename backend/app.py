from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
from apscheduler.schedulers.background import BackgroundScheduler
import atexit
import sys

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "products.csv")

# ─────────────────────────────────────────
#  DATA LOADER
# ─────────────────────────────────────────
def load_data():
    df = pd.read_csv(CSV_PATH)

    if "Unnamed: 5" in df.columns:
        df = df.drop(columns=["Unnamed: 5"])

    df["price"] = (
        df["price"]
        .astype(str)
        .str.replace(r"[^\d.]", "", regex=True)
    )
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["date"]  = pd.to_datetime(df["date"], errors="coerce")
    df["category"] = df["category"].astype(str).str.lower().str.strip()

    # remove rows where category looks like a price (corrupted data)
    df = df[~df["category"].str.match(r"^\d")]

    df = df.dropna(subset=["price", "date", "title"])
    return df


# ─────────────────────────────────────────
#  SCRAPER  (imported from scraper module)
# ─────────────────────────────────────────
def run_scraper():
    """Run the scraper — called automatically every day at midnight."""
    try:
        scraper_path = os.path.join(BASE_DIR, "..", "scraper")
        sys.path.insert(0, scraper_path)
        from scraper import scrape_all
        print("⏰ Scheduled scraping started…")
        scrape_all()
        print("✅ Scheduled scraping done!")
    except Exception as e:
        print(f"❌ Scraping error: {e}")


# ─────────────────────────────────────────
#  SCHEDULER  — daily at midnight
# ─────────────────────────────────────────
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=run_scraper,
    trigger="cron",
    hour=0,
    minute=0,
    id="daily_scrape"
)
scheduler.start()
atexit.register(lambda: scheduler.shutdown())


# ─────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────

@app.route("/")
def home():
    return "Jumia Tracker API 🚀"


@app.route("/debug")
def debug():
    df = load_data()
    return jsonify({"rows": len(df), "columns": list(df.columns)})


# 📊 category distribution
@app.route("/category-count")
def category_count():
    df = load_data()
    counts = df["category"].value_counts().reset_index()
    counts.columns = ["category", "count"]
    return counts.head(20).to_json(orient="records")


# 📈 category price evolution (all categories, last 200 data points)
@app.route("/categories")
def categories():
    df = load_data()
    grouped = df.groupby(
        [df["date"].dt.date, "category"]
    )["price"].mean().reset_index()
    pivot = grouped.pivot(
        index="date", columns="category", values="price"
    ).reset_index()
    return pivot.tail(200).to_json(orient="records")


# 🔍 NEW — single category price evolution (for clickable chart)
@app.route("/category/<string:cat>")
def category_detail(cat):
    df = load_data()
    cat_clean = cat.lower().strip()
    df_cat = df[df["category"] == cat_clean].copy()
    if df_cat.empty:
        return jsonify([])
    grouped = (
        df_cat.groupby(df_cat["date"].dt.date)["price"]
        .agg(["mean", "min", "max", "count"])
        .reset_index()
    )
    grouped.columns = ["date", "avg", "min", "max", "count"]
    grouped["date"] = grouped["date"].astype(str)
    return grouped.to_json(orient="records")


# 🔍 NEW — autocomplete suggestions (categories + product titles)
@app.route("/suggestions")
def suggestions():
    q = request.args.get("q", "").lower().strip()
    if len(q) < 2:
        return jsonify({"categories": [], "products": []})

    df = load_data()

    # matching categories
    all_cats = df["category"].unique().tolist()
    matched_cats = [c for c in all_cats if q in c.lower()][:8]

    # matching product titles (unique, limited)
    matched_products = (
        df[df["title"].str.lower().str.contains(q, na=False)]["title"]
        .drop_duplicates()
        .head(8)
        .tolist()
    )

    return jsonify({"categories": matched_cats, "products": matched_products})


# 📦 all products (limited)
@app.route("/products")
def products():
    df = load_data()
    return df.head(1000).to_json(orient="records")


# 📉 single product evolution
@app.route("/product/<int:id>")
def product(id):
    df = load_data()
    p = df[df["id"] == id].sort_values("date")
    return p.to_json(orient="records")


# 🔎 product search with price evolution
@app.route("/product-search")
def product_search():
    query = request.args.get("q", "").lower().strip()
    if not query:
        return jsonify([])
    df = load_data()

    # check if query matches a category
    all_cats = df["category"].unique().tolist()
    matched_cat = next((c for c in all_cats if c == query or query in c.lower()), None)

    if matched_cat:
        df_cat = df[df["category"] == matched_cat].copy()
        grouped = (
            df_cat.groupby(df_cat["date"].dt.date)["price"]
            .mean().reset_index()
        )
        grouped.columns = ["date", "price"]
        grouped["title"] = matched_cat.capitalize()
        grouped["category"] = matched_cat
        grouped["date"] = grouped["date"].astype(str)  # format YYYY-MM-DD propre
        return grouped.to_json(orient="records")

    # sinon cherche dans les titres
    results = df[df["title"].str.lower().str.contains(query, na=False)].copy()
    results = results.sort_values("date")
    results["date"] = results["date"].dt.strftime("%Y-%m-%d")
    return results[["title", "price", "date", "category"]].head(500).to_json(orient="records")
# ▶️ manually trigger scraper via API (useful for testing)
@app.route("/scrape-now", methods=["POST"])
def scrape_now():
    import threading
    t = threading.Thread(target=run_scraper)
    t.daemon = True
    t.start()
    return jsonify({"status": "Scraping started in background ⏳"})


# 🗓️ scraper status
@app.route("/scraper-status")
def scraper_status():
    job = scheduler.get_job("daily_scrape")
    if job:
        return jsonify({
            "status": "scheduled",
            "next_run": str(job.next_run_time)
        })
    return jsonify({"status": "not scheduled"})


# static React app
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path and os.path.exists(os.path.join("static", path)):
        return send_from_directory("static", path)
    return send_from_directory("static", "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
