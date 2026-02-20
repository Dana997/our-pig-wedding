const CATEGORIES = [
  { id: "hall", name: "웨딩홀" },
  { id: "sde", name: "스드메+예복" },
  { id: "parents", name: "양가준비" },
  { id: "honeymoon", name: "신혼여행" },
  { id: "home", name: "우리집" },
];

const STORAGE_KEY = "our_wedding_site_v1";

function money(n){
  const v = Number(n || 0);
  if (!isFinite(v)) return "0";
  return v.toLocaleString("ko-KR");
}
function parseMoney(s){
  if (typeof s !== "string") s = String(s ?? "");
  const cleaned = s.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}
function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2, 7);
}
function todayYMD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function ymdToDate(ymd){
  if(!ymd) return null;
  const [y,m,d] = ymd.split("-").map(Number);
  if(!y||!m||!d) return null;
  return new Date(y, m-1, d);
}

function defaultState(){
  const state = {
    meta: { title: "우리 결혼 준비 아지트" },
    summaryMemo: "",
    categories: {}
  };
  for (const c of CATEGORIES){
    state.categories[c.id] = { finalVendorId: null, vendors: [] };
  }
  return state;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.categories) return defaultState();
    for (const c of CATEGORIES){
      if (!parsed.categories[c.id]){
        parsed.categories[c.id] = { finalVendorId: null, vendors: [] };
      }
      // 필드 보정
      parsed.categories[c.id].vendors = (parsed.categories[c.id].vendors || []).map(v => ({
        id: v.id || uid(),
        name: v.name || "",
        link: v.link || "",
        photo: v.photo || "",
        memo: v.memo || "",
        date: v.date || "",           // ✅ 날짜
        dateTitle: v.dateTitle || "", // ✅ 일정 제목
        budget: Number(v.budget || 0),
        deposit: Number(v.deposit || 0),
        balance: Number(v.balance || 0),
      }));
      if (parsed.categories[c.id].finalVendorId === undefined) parsed.categories[c.id].finalVendorId = null;
    }
    if (typeof parsed.summaryMemo !== "string") parsed.summaryMemo = "";
    if (!parsed.meta) parsed.meta = { title: "우리 결혼 준비 아지트" };
    return parsed;
  }catch{
    return defaultState();
  }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

const $tabs = document.getElementById("tabs");
const $viewSummary = document.getElementById("view-summary");
const $viewCategory = document.getElementById("view-category");
const $catTitle = document.getElementById("catTitle");
const $vendorList = document.getElementById("vendorList");
const $btnAddVendor = document.getElementById("btnAddVendor");
const $siteTitle = document.getElementById("siteTitle");

const $kpiBudget = document.getElementById("kpiBudget");
const $kpiDeposit = document.getElementById("kpiDeposit");
const $kpiBalance = document.getElementById("kpiBalance");
const $kpiTotal = document.getElementById("kpiTotal");
const $finalList = document.getElementById("finalList");
const $upcomingList = document.getElementById("upcomingList");

const $summaryMemo = document.getElementById("summaryMemo");
const $btnSaveSummaryMemo = document.getElementById("btnSaveSummaryMemo");

const $btnExport = document.getElementById("btnExport");
const $importFile = document.getElementById("importFile");

const $calPrev = document.getElementById("calPrev");
const $calNext = document.getElementById("calNext");
const $calLabel = document.getElementById("calLabel");
const $calendar = document.getElementById("calendar");

const vendorTpl = document.getElementById("vendorCardTpl");

let active = { view: "summary", catId: null };
let calCursor = new Date(); // 달력 월 이동용 (현재 월 기준)

function setActiveView(view, catId=null){
  active = { view, catId };
  $viewSummary.classList.toggle("active", view === "summary");
  $viewCategory.classList.toggle("active", view === "category");

  [...$tabs.querySelectorAll(".tab")].forEach(btn=>{
    const isSummary = btn.dataset.view === "summary";
    const isCat = btn.dataset.catId && btn.dataset.catId === catId;
    btn.classList.toggle("active", (view==="summary" && isSummary) || (view==="category" && isCat));
  });

  render();
}

function buildTabs(){
  $tabs.innerHTML = "";

  const summaryBtn = document.createElement("button");
  summaryBtn.className = "tab";
  summaryBtn.textContent = "Summary";
  summaryBtn.dataset.view = "summary";
  summaryBtn.onclick = ()=> setActiveView("summary");
  $tabs.appendChild(summaryBtn);

  for (const c of CATEGORIES){
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = c.name;
    b.dataset.catId = c.id;
    b.onclick = ()=> setActiveView("category", c.id);
    $tabs.appendChild(b);
  }
}

function getCategory(catId){
  return state.categories[catId];
}

function computeTotalsFromFinals(){
  // 최종 업체만 비용 합산 (원하면 전체 후보 합계로 바꿀 수도 있음)
  let budget=0, deposit=0, balance=0, total=0;

  for (const c of CATEGORIES){
    const cat = getCategory(c.id);
    const finalId = cat.finalVendorId;
    if (!finalId) continue;
    const v = cat.vendors.find(x => x.id === finalId);
    if (!v) continue;

    budget += Number(v.budget || 0);
    deposit += Number(v.deposit || 0);
    balance += Number(v.balance || 0);
    total += Number(v.deposit || 0) + Number(v.balance || 0);
  }

  return { budget, deposit, balance, total };
}

function buildFinalList(){
  $finalList.innerHTML = "";

  for (const c of CATEGORIES){
    const cat = getCategory(c.id);
    const finalId = cat.finalVendorId;
    const v = finalId ? cat.vendors.find(x => x.id === finalId) : null;

    const div = document.createElement("div");
    div.className = "final-item";
    div.innerHTML = `
      <div>
        <strong>${c.name}</strong>
        <small>${v ? (v.name || "이름 없음") : "아직 선택 없음"}</small>
      </div>
      <div style="text-align:right">
        <div><small>예산 ${money(v?.budget || 0)}</small></div>
        <div><small>계약금 ${money(v?.deposit || 0)} · 잔금 ${money(v?.balance || 0)}</small></div>
      </div>
    `;
    $finalList.appendChild(div);
  }
}

function collectAllEvents(){
  // 날짜가 있는 항목들을 이벤트로 수집
  const events = [];
  for (const c of CATEGORIES){
    const cat = getCategory(c.id);
    for (const v of cat.vendors){
      if (!v.date) continue;
      events.push({
        catId: c.id,
        catName: c.name,
        vendorId: v.id,
        vendorName: v.name || "(이름 없음)",
        date: v.date,
        dateTitle: v.dateTitle || "",
        isFinal: cat.finalVendorId === v.id
      });
    }
  }
  // 날짜순 정렬
  events.sort((a,b)=> (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return events;
}

function buildUpcomingList(){
  $upcomingList.innerHTML = "";

  const now = ymdToDate(todayYMD());
  const events = collectAllEvents()
    .filter(e => ymdToDate(e.date) && ymdToDate(e.date) >= now)
    .slice(0, 8);

  if (events.length === 0){
    const div = document.createElement("div");
    div.className = "final-item";
    div.innerHTML = `<div><strong>등록된 일정이 없어요</strong><small>각 메뉴에서 날짜를 넣으면 여기랑 달력에 표시돼요.</small></div>`;
    $upcomingList.appendChild(div);
    return;
  }

  for (const e of events){
    const div = document.createElement("div");
    div.className = "final-item";
    const badge = e.isFinal ? " · 최종" : "";
    const title = e.dateTitle ? ` - ${e.dateTitle}` : "";
    div.innerHTML = `
      <div>
        <strong>${e.date}${badge}</strong>
        <small>${e.catName} · ${e.vendorName}${title}</small>
      </div>
      <div style="text-align:right">
        <button class="btn ghost" data-go="${e.catId}">열기</button>
      </div>
    `;
    div.querySelector("button").onclick = ()=> setActiveView("category", e.catId);
    $upcomingList.appendChild(div);
  }
}

function renderCalendar(){
  // 월간 달력(간단)
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth(); // 0-11
  $calLabel.textContent = `${year}년 ${month+1}월`;

  $calendar.innerHTML = "";

  const heads = ["일","월","화","수","목","금","토"];
  for (const h of heads){
    const hd = document.createElement("div");
    hd.className = "cal-head";
    hd.textContent = h;
    $calendar.appendChild(hd);
  }

  const first = new Date(year, month, 1);
  const last = new Date(year, month+1, 0);
  const startDay = first.getDay(); // 0 Sunday
  const totalDays = last.getDate();

  const events = collectAllEvents();
  const eventMap = new Map(); // ymd -> count + isFinal flag
  for (const e of events){
    if (!e.date) continue;
    if (!eventMap.has(e.date)) eventMap.set(e.date, { count:0, finalCount:0 });
    const obj = eventMap.get(e.date);
    obj.count += 1;
    if (e.isFinal) obj.finalCount += 1;
  }

  // 이전달 꼬리(빈칸)
  for (let i=0; i<startDay; i++){
    const cell = document.createElement("div");
    cell.className = "cal-cell mutedCell";
    cell.innerHTML = `<div class="cal-date"></div>`;
    $calendar.appendChild(cell);
  }

  const today = todayYMD();

  for (let day=1; day<=totalDays; day++){
    const y = year;
    const m = String(month+1).padStart(2,"0");
    const d = String(day).padStart(2,"0");
    const ymd = `${y}-${m}-${d}`;

    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (ymd === today) cell.classList.add("today");

    const meta = eventMap.get(ymd);
    const dots = [];
    if (meta){
      // 최종 일정(secondary dot) / 일반 일정(dot)
      const normal = Math.max(0, meta.count - meta.finalCount);
      for(let i=0;i<Math.min(3, normal);i++) dots.push(`<span class="dot"></span>`);
      for(let i=0;i<Math.min(2, meta.finalCount);i++) dots.push(`<span class="dot secondary"></span>`);
    }

    cell.innerHTML = `
      <div class="cal-date">${day}</div>
      <div class="cal-dots">${dots.join("")}</div>
    `;

    $calendar.appendChild(cell);
  }
}

function renderCategory(catId){
  const catMeta = CATEGORIES.find(x=>x.id===catId);
  const cat = getCategory(catId);
  $catTitle.textContent = catMeta ? catMeta.name : "카테고리";
  $vendorList.innerHTML = "";

  // 라디오 name을 카테고리별로 분리(동시에 여러 카테고리 보기 방지 안전장치)
  const radioName = `finalPick_${catId}`;

  for (const v of cat.vendors){
    const node = vendorTpl.content.firstElementChild.cloneNode(true);

    const $radio = node.querySelector(".radioFinal");
    const $badge = node.querySelector(".badge");
    const $name = node.querySelector(".vendorName");
    const $link = node.querySelector(".vendorLink");
    const $photo = node.querySelector(".vendorPhoto");
    const $memo = node.querySelector(".vendorMemo");
    const $date = node.querySelector(".vendorDate");
    const $dateTitle = node.querySelector(".vendorDateTitle");

    const $budget = node.querySelector(".vendorBudget");
    const $deposit = node.querySelector(".vendorDeposit");
    const $balance = node.querySelector(".vendorBalance");
    const $total = node.querySelector(".vendorTotal");
    const $linkOpen = node.querySelector(".linkOpen");

    const $preview = node.querySelector(".preview");
    const $previewImg = node.querySelector(".previewImg");

    $radio.name = radioName;
    $radio.checked = cat.finalVendorId === v.id;
    $badge.style.display = $radio.checked ? "inline-flex" : "none";

    $name.value = v.name;
    $link.value = v.link;
    $photo.value = v.photo;
    $memo.value = v.memo;
    $date.value = v.date || "";
    $dateTitle.value = v.dateTitle || "";

    $budget.value = v.budget ? String(v.budget) : "";
    $deposit.value = v.deposit ? String(v.deposit) : "";
    $balance.value = v.balance ? String(v.balance) : "";

    const refreshTotals = ()=>{
      const b = parseMoney($budget.value);
      const d = parseMoney($deposit.value);
      const bal = parseMoney($balance.value);
      $total.textContent = money(d + bal);

      // state update
      v.budget = b; v.deposit = d; v.balance = bal;
      saveState();
      if (active.view==="summary") renderSummary();
      else renderSummary(); // summary KPI도 갱신
    };

    const refreshLink = ()=>{
      const url = ($link.value || "").trim();
      if (url){
        $linkOpen.href = url;
        $linkOpen.style.pointerEvents = "auto";
        $linkOpen.style.opacity = "1";
      }else{
        $linkOpen.href = "javascript:void(0)";
        $linkOpen.style.pointerEvents = "none";
        $linkOpen.style.opacity = ".55";
      }
    };

    const refreshPhoto = ()=>{
      const url = ($photo.value || "").trim();
      if (url){
        $preview.classList.remove("hidden");
        $previewImg.src = url;
      }else{
        $preview.classList.add("hidden");
        $previewImg.removeAttribute("src");
      }
    };

    $radio.onchange = ()=>{
      cat.finalVendorId = v.id;
      saveState();
      render(); // badge 표시/summary 반영
    };

    $name.oninput = ()=>{ v.name = $name.value; saveState(); renderSummary(); };
    $link.oninput = ()=>{ v.link = $link.value; saveState(); refreshLink(); };
    $photo.oninput = ()=>{ v.photo = $photo.value; saveState(); refreshPhoto(); };
    $memo.oninput = ()=>{ v.memo = $memo.value; saveState(); };

    $date.oninput = ()=>{ v.date = $date.value; saveState(); renderSummary(); };
    $dateTitle.oninput = ()=>{ v.dateTitle = $dateTitle.value; saveState(); renderSummary(); };

    $budget.oninput = refreshTotals;
    $deposit.oninput = refreshTotals;
    $balance.oninput = refreshTotals;

    refreshTotals();
    refreshLink();
    refreshPhoto();

    node.querySelector(".btnDel").onclick = ()=>{
      // 삭제 시 최종 선택도 정리
      cat.vendors = cat.vendors.filter(x => x.id !== v.id);
      if (cat.finalVendorId === v.id) cat.finalVendorId = null;
      saveState();
      render();
    };

    $vendorList.appendChild(node);
  }
}

function renderSummary(){
  $siteTitle.textContent = state.meta.title || "우리 결혼 준비 아지트";
  $summaryMemo.value = state.summaryMemo || "";

  const t = computeTotalsFromFinals();
  $kpiBudget.textContent = money(t.budget);
  $kpiDeposit.textContent = money(t.deposit);
  $kpiBalance.textContent = money(t.balance);
  $kpiTotal.textContent = money(t.total);

  buildFinalList();
  buildUpcomingList();
  renderCalendar();
}

function render(){
  if (active.view === "summary") renderSummary();
  if (active.view === "category" && active.catId) renderCategory(active.catId);
}

// 버튼/이벤트
$btnAddVendor.onclick = ()=>{
  if (!active.catId) return;
  const cat = getCategory(active.catId);
  cat.vendors.unshift({
    id: uid(),
    name: "",
    link: "",
    photo: "",
    memo: "",
    date: "",
    dateTitle: "",
    budget: 0,
    deposit: 0,
    balance: 0,
  });
  saveState();
  render();
};

$btnSaveSummaryMemo.onclick = ()=>{
  state.summaryMemo = $summaryMemo.value || "";
  saveState();
};

$btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "our-wedding-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

$importFile.onchange = async ()=>{
  const file = $importFile.files?.[0];
  if (!file) return;
  const text = await file.text();
  try{
    const imported = JSON.parse(text);
    state = imported;
    // 보정 후 저장
    state = loadStateFromImported(state);
    saveState();
    render();
    alert("가져오기 완료!");
  }catch{
    alert("JSON 파일이 올바르지 않아요.");
  }finally{
    $importFile.value = "";
  }
};

function loadStateFromImported(imported){
  // 안전하게 defaultState 기반으로 덮어쓰기
  const base = defaultState();
  base.meta.title = imported?.meta?.title || base.meta.title;
  base.summaryMemo = imported?.summaryMemo || "";

  for (const c of CATEGORIES){
    const srcCat = imported?.categories?.[c.id];
    if (!srcCat) continue;
    base.categories[c.id].finalVendorId = srcCat.finalVendorId || null;
    base.categories[c.id].vendors = (srcCat.vendors || []).map(v => ({
      id: v.id || uid(),
      name: v.name || "",
      link: v.link || "",
      photo: v.photo || "",
      memo: v.memo || "",
      date: v.date || "",
      dateTitle: v.dateTitle || "",
      budget: Number(v.budget || 0),
      deposit: Number(v.deposit || 0),
      balance: Number(v.balance || 0),
    }));
  }
  return base;
}

// 달력 이동
$calPrev.onclick = ()=>{
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()-1, 1);
  renderSummary();
};
$calNext.onclick = ()=>{
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 1);
  renderSummary();
};

// 초기화
buildTabs();
setActiveView("summary");
