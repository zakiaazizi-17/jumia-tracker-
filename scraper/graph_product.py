import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("products.csv", engine="python", on_bad_lines="skip")

# 🧹 تنظيف price
df["price"] = (
    df["price"]
    .astype(str)
    .str.replace(r"[^\d.]", "", regex=True)
)
df["price"] = pd.to_numeric(df["price"], errors="coerce")

# 📅 date
df["date"] = pd.to_datetime(df["date"], errors="coerce")

# 🔤 title normalize
df["title"] = df["title"].astype(str).str.lower().str.strip()

# 👇 إدخال المنتج EXACT
product_name = input("Enter exact product name: ").lower().strip()

# ✅ فلترة exact
product_df = df[df["title"] == product_name]

# ❌ إلا ماكاينش
if product_df.empty:
    print("❌ Exact product not found")
    print("\n🔍 Suggestions:")
    print(df["title"].drop_duplicates().head(10))  # يعطيك أمثلة
    exit()

# 📊 ترتيب
product_df = product_df.sort_values("date")

# 📈 graph
plt.figure(figsize=(10,5))
plt.plot(product_df["date"], product_df["price"], marker="o")

plt.title(f"📈 Price Evolution: {product_name}")
plt.xlabel("Date")
plt.ylabel("Price (Dhs)")
plt.xticks(rotation=45)
plt.grid()

plt.show()