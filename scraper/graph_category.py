import pandas as pd
import matplotlib.pyplot as plt

# قراءة CSV عادية (الأصح)
df = pd.read_csv("products.csv", engine="python", on_bad_lines="skip")

# تنظيف price (حل قوي ومرن)
df["price"] = (
    df["price"]
    .astype(str)
    .str.replace(r"[^\d.]", "", regex=True)  # يحيد أي حاجة ماشي رقم
)

df["price"] = pd.to_numeric(df["price"], errors="coerce")

# حذف القيم الخاسرة
df = df.dropna(subset=["price"])

# date
df["date"] = pd.to_datetime(df["date"], errors="coerce")
df = df.dropna(subset=["date"])

# grouping
grouped = df.groupby([df["date"].dt.date, "category"])["price"].mean().reset_index()

# pivot
pivot = grouped.pivot(index="date", columns="category", values="price")

# plot
pivot.plot(figsize=(12,6), marker="o")

plt.xlabel("Date")
plt.ylabel("Price (Dhs)")
plt.title("Price Evolution by Category")
plt.grid()

plt.show()