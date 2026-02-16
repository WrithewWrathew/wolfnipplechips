export const config = {
  runtime: "edge"
};

export default async function handler(request) {

  try {

    // Dynamically generate date range
    // (last 14 days ensures we always catch latest update)

    const today = new Date();
    const endDate = today.toLocaleDateString("en-GB");
    
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const startDate = start.toLocaleDateString("en-GB");

    const csvURL =
      `https://www.australiansuper.com/api/graphs/dailyrates/download/?start=${startDate}&end=${endDate}&cumulative=False&superType=super&truncateDecimalPlaces=True&outputFilename=temp.csv`;

    const response = await fetch(csvURL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      },

      // Edge cache — massive performance boost
      next: { revalidate: 3600 } // cache 1 hour
    });

    if (!response.ok) {
      throw new Error("Failed to fetch CSV");
    }

    const csv = await response.text();

    const lines = csv
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error("CSV has insufficient data");
    }

    const headers = lines[0].split(",").map(h => h.trim());

    const intlIndex = headers.findIndex(h =>
      h.toLowerCase().includes("international shares")
    );

    if (intlIndex === -1) {
      throw new Error("International Shares column not found");
    }

    let latestValue = null;
    let latestDate = null;

    // Walk backwards to find latest non-zero entry
    for (let i = lines.length - 1; i > 0; i--) {

      const cols = lines[i].split(",").map(c => c.trim());

      const val = parseFloat(cols[intlIndex]);

      if (!isNaN(val) && Math.abs(val) > 0.00001) {
        latestValue = val;
        latestDate = cols[0];
        break;
      }
    }

    return new Response(
      JSON.stringify({
        value: latestValue !== null ? latestValue.toFixed(4) : null,
        date: latestDate,
        fetchedAt: new Date().toISOString()
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600"
        }
      }
    );

  } catch (err) {

    return new Response(
      JSON.stringify({
        error: err.message
      }),
      { status: 500 }
    );

  }
}
