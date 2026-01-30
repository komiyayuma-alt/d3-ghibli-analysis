// js/c_dashboard.js
(() => {
  const statusEl = document.querySelector("#statusC");
  const chartEl = document.querySelector("#chartC");
  const tbody = document.querySelector("#tableBody");

  const xMetricEl = document.querySelector("#xMetric");
  const directorEl = document.querySelector("#directorFilter");
  const yearMinEl = document.querySelector("#yearMin");
  const yearMaxEl = document.querySelector("#yearMax");
  const yearMinLabel = document.querySelector("#yearMinLabel");
  const yearMaxLabel = document.querySelector("#yearMaxLabel");

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
    const title = pick(raw, ["title", "Title", "name", "Name", "film", "Film"]);
    const year = toNumber(pick(raw, ["year", "Year", "release_year", "ReleaseYear"]));
    const director = pick(raw, ["director", "Director", "dir", "Dir"]);
    const rating = toNumber(pick(raw, ["imdb_rating", "IMDb", "imdb", "rating", "Rating", "score", "Score"]));
    const runtime = toNumber(pick(raw, ["runtime", "Runtime", "running_time", "RunningTime", "minutes", "Minutes", "duration", "Duration"]));
    const gross = toNumber(pick(raw, ["gross", "Gross", "box_office", "BoxOffice", "revenue", "Revenue"]));
    return { title, year, director, rating, runtime, gross, _raw: raw };
  };

  const fmt = {
    gross(v) {
      if (!Number.isFinite(v)) return "—";
      // 桁が大きい想定： 1234567890 → 1.23B みたいに
      if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
      if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
      if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
      return String(v);
    }
  };

  let ALL = [];
  let svg, g, xScale, yScale, colorScale, brushG;
  let currentSelection = new Set();

  const getFiltered = () => {
    const metric = xMetricEl.value;
    const dir = directorEl.value;

    const yMin = Math.min(Number(yearMinEl.value), Number(yearMaxEl.value));
    const yMax = Math.max(Number(yearMinEl.value), Number(yearMaxEl.value));

    return ALL.filter(d => {
      if (!Number.isFinite(d.rating)) return false;
      if (!Number.isFinite(d.year)) return false;
      if (d.year < yMin || d.year > yMax) return false;
      if (dir !== "ALL" && d.director !== dir) return false;

      const xv = d[metric];
      if (!Number.isFinite(xv)) return false;
      return true;
    });
  };

  const updateTable = (rows) => {
    if (!tbody) return;
    tbody.innerHTML = "";

    const limited = rows.slice(0, 30);
    for (const d of limited) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:8px; border-top: 1px solid rgba(255,255,255,.08);">${d.title ?? "—"}</td>
        <td style="padding:8px; border-top: 1px solid rgba(255,255,255,.08);">${Number.isFinite(d.year) ? d.year : "—"}</td>
        <td style="padding:8px; border-top: 1px solid rgba(255,255,255,.08);">${d.director ?? "—"}</td>
        <td style="padding:8px; border-top: 1px solid rgba(255,255,255,.08);">${Number.isFinite(d.rating) ? d.rating : "—"}</td>
        <td style="padding:8px; border-top: 1px solid rgba(255,255,255,.08);">${fmt.gross(d.gross)}</td>
      `;
      tbody.appendChild(tr);
    }
  };

  const renderBase = () => {
    chartEl.innerHTML = "";

    const margin = { top: 30, right: 30, bottom: 60, left: 70 };
    const width = 980, height = 520;

    svg = d3.select(chartEl)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("max-width", "100%")
      .style("height", "auto");

    g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    xScale = d3.scaleLinear().range([0, innerW]);
    yScale = d3.scaleLinear().range([innerH, 0]);

    // axes groups
    g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerH})`);
    g.append("g").attr("class", "y-axis");

    // labels
    g.append("text")
      .attr("class", "x-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 48)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("opacity", .85);

    g.append("text")
      .attr("class", "y-label")
      .attr("x", -innerH / 2)
      .attr("y", -50)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("opacity", .85)
      .text("評価（IMDb等）");

    // brush
    brushG = g.append("g").attr("class", "brush");

    // click to clear selection
    svg.on("click", (event) => {
      // 背景クリックなら解除（点クリックと区別したいので target を見る）
      if (event.target.tagName.toLowerCase() === "svg") {
        currentSelection.clear();
        updateTable([]);
        g.selectAll("circle").attr("stroke-width", 1).attr("opacity", 0.92);
      }
    });
  };

  const updateChart = () => {
    const metric = xMetricEl.value;
    const data = getFiltered();

    if (data.length === 0) {
      setStatus("フィルタ後データが0件。列名/値/レンジを確認して。", true);
      chartEl.innerHTML = "";
      updateTable([]);
      return;
    }

    if (!svg) renderBase();

    const innerW = Number(svg.attr("viewBox").split(" ")[2]) - 70 - 30; // width - left - right
    const innerH = Number(svg.attr("viewBox").split(" ")[3]) - 30 - 60; // height - top - bottom

    // scales
    xScale.domain(d3.extent(data, d => d[metric])).nice();
    yScale.domain(d3.extent(data, d => d.rating)).nice();

    // color by director
    const directors = Array.from(new Set(data.map(d => d.director))).sort(d3.ascending);
    colorScale = d3.scaleOrdinal()
      .domain(directors)
      .range(d3.schemeTableau10.concat(d3.schemeSet3));

    // axes
    g.select(".x-axis").call(d3.axisBottom(xScale).ticks(8));
    g.select(".y-axis").call(d3.axisLeft(yScale).ticks(8));

    // x label
    const label = metric === "runtime" ? "上映時間（分）" : metric === "gross" ? "興行収入（Gross）" : "公開年";
    g.select(".x-label").text(label);

    // draw points
    const pts = g.selectAll("circle").data(data, d => (d.title ?? "") + "_" + d.year);

    pts.exit().remove();

    const enter = pts.enter().append("circle")
      .attr("r", 6)
      .attr("stroke", "rgba(255,255,255,.18)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.92)
      .attr("fill", d => colorScale(d.director));

    enter.merge(pts)
      .attr("cx", d => xScale(d[metric]))
      .attr("cy", d => yScale(d.rating))
      .attr("fill", d => colorScale(d.director));

    // brush selection
    const brush = d3.brush()
      .extent([[0, 0], [innerW, innerH]])
      .on("end", (event) => {
        const sel = event.selection;
        currentSelection.clear();

        if (!sel) {
          updateTable([]);
          g.selectAll("circle").attr("stroke-width", 1).attr("opacity", 0.92);
          return;
        }

        const [[x0, y0], [x1, y1]] = sel;

        const selected = data.filter(d => {
          const cx = xScale(d[metric]);
          const cy = yScale(d.rating);
          return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        });

        selected.forEach(d => currentSelection.add((d.title ?? "") + "_" + d.year));

        g.selectAll("circle")
          .attr("stroke-width", d => currentSelection.has((d.title ?? "") + "_" + d.year) ? 2.5 : 1)
          .attr("opacity", d => currentSelection.has((d.title ?? "") + "_" + d.year) ? 1 : 0.35);

        // table
        updateTable(selected.sort((a, b) => (b.rating - a.rating)));
      });

    brushG.call(brush);

    setStatus(`読み込みOK：${data.length}件（Y=評価固定 / X=${label}）`);
  };

  const initUI = () => {
    // year range
    const years = ALL.map(d => d.year).filter(Number.isFinite);
    const yMin = Math.min(...years);
    const yMax = Math.max(...years);

    yearMinEl.min = String(yMin);
    yearMinEl.max = String(yMax);
    yearMaxEl.min = String(yMin);
    yearMaxEl.max = String(yMax);
    yearMinEl.value = String(yMin);
    yearMaxEl.value = String(yMax);

    const syncLabels = () => {
      const a = Math.min(Number(yearMinEl.value), Number(yearMaxEl.value));
      const b = Math.max(Number(yearMinEl.value), Number(yearMaxEl.value));
      yearMinLabel.textContent = String(a);
      yearMaxLabel.textContent = String(b);
    };

    // directors
    const dirs = Array.from(new Set(ALL.map(d => d.director).filter(Boolean))).sort(d3.ascending);
    for (const dir of dirs) {
      const opt = document.createElement("option");
      opt.value = dir;
      opt.textContent = dir;
      directorEl.appendChild(opt);
    }

    // listeners
    const rerender = () => {
      syncLabels();
      updateChart();
    };

    xMetricEl.addEventListener("change", rerender);
    directorEl.addEventListener("change", rerender);
    yearMinEl.addEventListener("input", rerender);
    yearMaxEl.addEventListener("input", rerender);

    syncLabels();
  };

  const main = async () => {
    setStatus("CSV読み込み中…");

    try {
      const raw = await d3.csv("./data/ghibli.csv");
      const normalized = raw.map(normalizeRow);

      ALL = normalized;

      // ここで “最低限” 必要な rating/year が取れてないと C 全体が死ぬのでチェック
      const ok = ALL.filter(d => Number.isFinite(d.rating) && Number.isFinite(d.year));
      if (ok.length === 0) {
        console.log("raw rows:", raw.slice(0, 5));
        console.log("normalized rows:", normalized.slice(0, 5));
        setStatus("データ0件。CSV列名が違う可能性。コンソール確認して。", true);
        return;
      }

      initUI();
      updateChart();
    } catch (e) {
      console.error(e);
      setStatus(`CSV読み込み失敗：${e?.message ?? e}`, true);
    }
  };

  main();
})();
