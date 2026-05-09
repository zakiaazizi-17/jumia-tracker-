import requests
from bs4 import BeautifulSoup
import csv
from datetime import datetime  # kay sauvegardi date dial kula scraping
import os  # kaychuf wach lfile kayn
import time  # for sleep

HEADERS = {"User-Agent": "Mozilla/5.0"}

CATEGORIES = [
    "electronics",
    "phones",
    "computing",
    "fashion",
    "shoes",
    "home",
    "beauty",
    "gaming",
    "sports",
    "toys"
]

# 📍 path correct dyal backend CSV
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "backend", "products.csv")


# 🔎 scrape one category page
def get_products(category, page):
    url = f"https://www.jumia.ma/catalog/?q={category}&page={page}"
    r = requests.get(url, headers=HEADERS)

    if r.status_code != 200:
        return []  # ila matl3 walo returni liste khawya

    soup = BeautifulSoup(r.text, "html.parser")
    items = soup.find_all("article", class_="prd")

    products = []

    for item in items:
        try:
            title = item.find("h3", class_="name").text.strip()
            price = item.find("div", class_="prc").text.strip()

            products.append(  # 7t l item fla liste
                {
                    "title": title,
                    "price": price,
                    "category": category
                }
            )

        except:
            continue  # ila matl3 walo duz l item lakhor

    return products


# 💾 save to CSV
def save_to_csv(products):
    file_exists = os.path.isfile(CSV_PATH)  # kanchufu wach lfile kayn

    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:  # a : add without deleting old data
        writer = csv.DictWriter(
            f,  # f houa l file
            fieldnames=["id", "title", "price", "category", "date"],
            quoting=csv.QUOTE_ALL  # add "" to every value
        )

        if not file_exists:
            writer.writeheader()  # ila kan lfile jdid 9ad lih headers

        for i, p in enumerate(products):
            writer.writerow({
                "id": int(datetime.now().timestamp() * 1000) + i,
                "title": p["title"],
                "price": p["price"],
                "category": p["category"],
                "date": datetime.now()
            })


# 🚀 main scraping function
def scrape_all():
    print("🚀 Starting scraping...")

    for cat in CATEGORIES:
        print(f"🔍 Category: {cat}")  # f variables inside text

        page = 1

        while True:
            products = get_products(cat, page)

            if not products:
                break

            save_to_csv(products)

            print(f"   page {page} → {len(products)} products")

            page += 1
            time.sleep(1)

    print("✅ Done scraping!")


# ▶️ run manually
if __name__ == "__main__":  # kayt9la fach kadir python scraper.py
    scrape_all()