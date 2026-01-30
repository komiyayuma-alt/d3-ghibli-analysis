// js/b_scatter_tooltip.js
(() => {
  const statusEl = document.querySelector("#status");
  const chartEl = document.querySelector("#chart");

  const setStatus = (msg, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.style.color = isError ? "#ff9aa2" : "inherit";
  };

  const pick = (d, keys) => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && String(d[k]).trim() !== "") return d[k];
    }
    return null;
  };

  const toNumber = (v) => {
    if (v === null || v === undefined) return NaN;
    const n = Number(String(v).replace(/[,￥$]/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  };

  const normalizeRow = (raw) => {
    // 列名ゆらぎ吸収
    const title = pick(raw, ["title", "Title", "name", "Name", "film", "Film"]);
    const year = toNumber(pick(raw, ["year", "Year", "release_year", "ReleaseYear"]));
    const director = pick(raw, ["director", "Director", "dir", "Dir"]);
    const rating = toNumber(pick(raw, ["imdb_rating", "IMDb", "imdb", "rating", "Rating", "score", "Score"]));
    const runtime = toNumber(pick(raw, ["runtime", "Runtime", "running_time", "RunningTime", "minutes", "Minutes", "duration", "Duration"]));

    return { title, year, director, rating, runtime, _raw: raw };
  };

  const tooltip = (() => {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.pointerEvents = "none";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(20, 25, 35, .92)";
    el.style.border = "1px solid rgba(255,255,255,.12)";
    el.style.backdropFilter = "blur(8px)";
    el.style.color = "#fff";
    el.style.fontSize = "12px";
    el.style.lineHeight = "1.35";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    el.style.opacity = "0";
    el.style.transition = "opacity .12s ease";
    document.body.appendChild(el);

    return {
      show(html, x, y) {
        el.innerHTML = html;
        el.style.left = `${x + 12}px`;
        el.style.top = `${y + 12}px`;
        el.style.opacity = "1";
      },
      move(x, y) {
        el.style.left = `${x + 12}px`;
        el.style.top = `${y + 12}px`;
      },
      hide() {
        el.style.opacity = "0";
      },
    };
  })();

  const render = (data) => {
    chartEl.innerHTML = "";

    const margin = { top: 30, right: 20, bottom: 55, left: 70 };
    const width = 920, height = 520;

    const svg = d3.select(chartEl)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("max-width", "100%")
      .style("height", "auto");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.runtime))
      .nice()
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.rating))
      .nice()
      .range([innerH, 0]);

    const directors = Array.from(new Set(data.map(d => d.director))).sort(d3.ascending);
    const color = d3.scaleOrdinal()
      .domain(directors)
      .range(d3.schemeTableau10.concat(d3.schemeSet3));

    // axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8))
      .call(s => s.selectAll("text").style("font-size", "12px"));

    g.append("g")
      .call(d3.axisLeft(y).ticks(8))
      .call(s => s.selectAll("text").style("font-size", "12px"));

    // labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 45)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("opacity", .85)
      .text("上映時間（分）");

    g.append("text")
      .attr("x", -innerH / 2)
      .attr("y", -48)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("opacity", .85)
      .text("評価（IMDb等）");

    // grid (薄く)
    g.append("g")
      .attr("opacity", 0.12)
      .call(
        d3.axisLeft(y)
          .ticks(8)
          .tickSize(-innerW)
          .tickFormat("")
      )
      .select(".domain").remove();

    // points
    g.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.runtime))
      .attr("cy", d => y(d.rating))
      .attr("r", 6)
      .attr("fill", d => color(d.director))
      .attr("opacity", 0.92)
      .attr("stroke", "rgba(255,255,255,.18)")
      .attr("stroke-width", 1)
      .on("mouseenter", (event, d) => {
        const html = `
          <div style="font-weight:700; font-size:13px; margin-bottom:6px;">${d.title ?? "（タイトル不明）"}</div>
          <div>年：${Number.isFinite(d.year) ? d.year : "—"}</div>
          <div>監督：${d.director ?? "—"}</div>
          <div>評価：${Number.isFinite(d.rating) ? d.rating : "—"}</div>
          <div>上映：${Number.isFinite(d.runtime) ? d.runtime + "分" : "—"}</div>
        `;
        tooltip.show(html, event.clientX, event.clientY);
        d3.select(event.currentTarget).attr("r", 8).attr("opacity", 1);
      })
      .on("mousemove", (event) => tooltip.move(event.clientX, event.clientY))
      .on("mouseleave", (event) => {
        tooltip.hide();
        d3.select(event.currentTarget).attr("r", 6).attr("opacity", 0.92);
      });

    setStatus(`読み込みOK：${data.length}件`);
  };

  const main = async () => {
    setStatus("CSV読み込み中…");

    try {
      // 重要：GitHub Pagesでは b.html はルートなので ./data/ghibli.csv でOK
      const raw = await d3.csv("./data/ghibli.csv");

      const normalized = raw.map(normalizeRow);

      // 必須項目（runtime/rating）が揃ってる行だけ
      const data = normalized.filter(d =>
        Number.isFinite(d.runtime) &&
        Number.isFinite(d.rating)
      );

      if (data.length === 0) {
        console.log("raw rows:", raw.slice(0, 5));
        console.log("normalized rows:", normalized.slice(0, 5));
        setStatus("データ0件。CSVの列名が違うか、値が空かも。コンソールにログ出してる。", true);
        return;
      }

      render(data);
    } catch (e) {
      console.error(e);
      setStatus(`CSV読み込み失敗：${e?.message ?? e}`, true);
    }
  };

  main();
})();
