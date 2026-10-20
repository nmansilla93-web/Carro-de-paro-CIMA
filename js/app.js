/* ===== Inventario por defecto ===== */
const it=(n,q,prov)=>({k:slug(n),n,q,prov:!!prov});
function slug(s){return s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
const CAJA=()=>[
 {t:"Medicación",items:[it("Adrenalina 1 mg/ml",5),it("Atropina 1 mg/ml",5),it("Midazolam 15 mg/3 ml",5),it("Lidocaína 2%",5),it("Dexametasona",5),it("Difenhidramina",5),it("Hidrocortisona 100 mg",2),it("Hidrocortisona 500 mg",2),it("Solución fisiológica (ampolla)",5)]},
 {t:"Acceso venoso",items:[it("Abbocath 20 G",2),it("Abbocath 22 G",2),it("Abbocath 24 G",2),it("Jeringa 10 ml",5,1),it("Jeringa 1 ml",5,1),it("Aguja 40/8",5,1),it("Llave de 3 vías",2),it("Cinta",1),it("Gasas (paquete)",5)]},
 {t:"Oxigenoterapia adulto",items:[it("Máscara Venturi adulto",1),it("Máscara con reservorio adulto",1),it("Cánula nasal adulto",2)]},
 {t:"Oxigenoterapia pediátrica",items:[it("Máscara simple pediátrica",1),it("Máscara con reservorio pediátrica",1),it("Cánula nasal pediátrica",2)]}
];
const DEFAULT_INV={
 caja1:{nombre:"Caja 1",tipo:"Caja de emergencia",secciones:CAJA()},
 caja2:{nombre:"Caja 2",tipo:"Caja de emergencia",secciones:CAJA()},
 caja3:{nombre:"Caja 3",tipo:"Caja de emergencia",secciones:CAJA()},
 carro:{nombre:"Carro de paro",tipo:"Carro",secciones:[
  {t:"Medicación",items:[it("Adrenalina 1 mg/ml",10),it("Atropina 1 mg/ml",10),it("Lidocaína 2%",5),it("Midazolam 15 mg/3 ml",10),it("Difenhidramina 10 mg",10),it("Difenhidramina 50 mg",2),it("Dexametasona 8 mg",10),it("Hidrocortisona 500 mg",2),it("Salbutamol aerosol 100 mcg/dosis",1)]},
  {t:"Vía aérea",items:[it("Tubo endotraqueal 6",1,1),it("Tubo endotraqueal 6,5",1,1),it("Tubo endotraqueal 7",1,1),it("Tubo endotraqueal 7,5",1,1),it("Tubo endotraqueal 8",1,1),it("Tubo pediátrico con balón 3",1,1),it("Tubo pediátrico con balón 3,5",1,1),it("Tubo pediátrico con balón 4",1,1),it("Tubo pediátrico con balón 4,5",1,1),it("Tubo pediátrico con balón 5",1,1),it("Máscara laríngea N.º 5",2),it("Aerocámara",1,1)]},
  {t:"Acceso venoso e insumos",items:[it("Abbocath 20 G",2,1),it("Abbocath 22 G",2,1),it("Abbocath 24 G",2,1),it("Aguja 18 G",5,1),it("Aguja 21 G",5,1),it("Jeringa 1 ml",5,1),it("Jeringa 5 ml",5,1),it("Jeringa 10 ml",5,1),it("Llave de 3 vías",2),it("Cinta",1),it("Lidocaína jalea 2%",1,1),it("Electrodos",10,1)]}
 ],equipos:["Monitor/desfibrilador enciende y tiene carga","Aspirador funciona y el frasco está limpio","Descartador cortopunzante por debajo de 3/4"]}
};
const ORDER=["caja1","caja2","caja3","carro"];
const MOTIVOS=["Uso en emergencia","Faja dañada o violada","Control mensual programado","Reposición por vencimiento","Otro"];

/* ===== Estado ===== */
let INV=structuredClone(DEFAULT_INV);
let ESTADO={}; // unidad -> {faja, fajaFecha, vtos:{k:"YYYY-MM"}, ultimaApertura}
let REG=[];    // registros
let db=null,user=null,uid=null,canWrite=true,canEditInv=false,dl=null,dbReady=false,localMode=false;
let view="hoy",histFilter="todas";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}

/* ===== Fechas ===== */
function dayKey(d=new Date()){const z=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())}
function fmtDT(iso){const d=new Date(iso);return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"})+" "+d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
function fmtD(iso){return new Date(iso).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"})}
function fmtVto(m){if(!m)return"—";const [y,mo]=m.split("-");return mo+"/"+y}
function diasVto(m){if(!m)return null;const [y,mo]=m.split("-").map(Number);const fin=new Date(y,mo,0,23,59);return Math.floor((fin-new Date())/864e5)}
function vtoClass(d){if(d===null)return"p-mute";if(d<0)return"p-crit";if(d<=60)return"p-pend";return"p-ok"}
function vtoLabel(d){if(d===null)return"Sin cargar";if(d<0)return"Vencido";if(d<=60)return"Vence en "+d+" d";return"Vigente"}
function diasDesde(iso){return iso?Math.floor((new Date()-new Date(iso))/864e5):null}

/* ===== Derivados ===== */
function allItems(u){return INV[u].secciones.flatMap(s=>s.items.map(i=>({...i,sec:s.t})))}
function diarioHoy(u){const h=dayKey();return REG.find(r=>r.unidad===u&&r.tipo==="diario"&&dayKey(new Date(r.fecha))===h)}
function proxVto(u){const v=(ESTADO[u]||{}).vtos||{};let best=null;for(const i of allItems(u)){const m=v[i.k];if(!m)continue;const d=diasVto(m);if(best===null||d<best.d)best={d,m,n:i.n}}return best}
function unitStatus(u){
  const e=ESTADO[u]; const dh=diarioHoy(u); const pv=proxVto(u);
  if(!e||!e.faja)return{c:"s-pend",pill:["p-pend","Sin faja registrada"]};
  if(dh&&dh.estadoFaja==="rota")return{c:"s-crit",pill:["p-crit","Faja rota: reponer"]};
  if(pv&&pv.d<0)return{c:"s-crit",pill:["p-crit","Ítem vencido"]};
  const dm=diasDesde(e.ultimaApertura); if(dm!==null&&dm>31)return{c:"s-pend",pill:["p-pend","Control mensual vencido"]};
  if(!dh)return{c:"s-pend",pill:["p-pend","Control de hoy pendiente"]};
  return{c:"s-ok",pill:["p-ok","Control de hoy OK"]};
}
function vtoAlertCount(){let n=0;for(const u of ORDER){const v=(ESTADO[u]||{}).vtos||{};for(const i of allItems(u)){const d=diasVto(v[i.k]);if(d!==null&&d<=60)n++}}return n}

/* ===== Render ===== */
function render(){
  $("#hoyTxt").textContent=new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.v===view));
  const n=vtoAlertCount(),bd=$("#vtoBadge"); bd.hidden=!n; bd.textContent=n;
  const m=$("#main"); let h="";
  if(!dbReady) h+=`<div class="banner info">Conectando con el registro compartido…</div>`;
  else if(!db) h+=`<div class="banner">No se pudo acceder al almacenamiento de este navegador. Revisá que no esté en modo privado ni con los datos de sitios bloqueados.</div>`;
  else if(localMode) h+=`<div class="banner info">Modo local: los controles se guardan solo en este navegador. Usá <b>Exportar respaldo</b> en Historial para no perderlos.</div>`;
  else if(!canWrite) h+=`<div class="banner">Tenés acceso de solo lectura. Pedile a la coordinación que te dé permiso de Colaborador para registrar controles.</div>`;
  if(view==="hoy")h+=vHoy(); if(view==="vto")h+=vVto(); if(view==="hist")h+=vHist(); if(view==="cont")h+=vCont(); if(view==="como")h+=vComo();
  m.innerHTML=h; bindMain();
}
function vHoy(){
  const pend=ORDER.filter(u=>!diarioHoy(u)).length;
  let h=`<div class="toolbar" style="justify-content:space-between"><h2 class="sec">Estado de las 4 unidades</h2>
    <button class="btn primary" data-act="diario-todas" ${!db||!canWrite?"disabled":""}>Control diario${pend?` (${pend} pendiente${pend>1?"s":""})`:" ✓"}</button></div><div class="grid">`;
  for(const u of ORDER){
    const e=ESTADO[u]||{},s=unitStatus(u),dh=diarioHoy(u),pv=proxVto(u),dm=diasDesde(e.ultimaApertura);
    h+=`<article class="unit ${s.c}">
      <div class="head"><h3>${esc(INV[u].nombre)}</h3><span class="kind">${esc(INV[u].tipo)}</span></div>
      <span class="pill ${s.pill[0]}">${s.pill[1]}</span>
      <div class="faja">${e.faja?esc(e.faja):"———"}<small>Faja vigente${e.fajaFecha?" desde "+fmtD(e.fajaFecha):""}</small></div>
      <div class="facts">
        <div><span>Control de hoy</span><span>${dh?(dh.estadoFaja==="ok"?"Íntegra":"Rota")+" · "+fmtDT(dh.fecha).split(" ")[1]:"—"}</span></div>
        <div><span>Última apertura</span><span>${e.ultimaApertura?`hace ${dm} d`:"—"}</span></div>
        <div><span>Próximo vto.</span><span>${pv?`${fmtVto(pv.m)}`:"Sin cargar"}</span></div>
      </div>
      <div class="actions">
        <button class="btn sm" data-act="diario" data-u="${u}" ${!db||!canWrite?"disabled":""}>Control diario</button>
        <button class="btn sm ${s.c==="s-crit"?"danger":""}" data-act="apertura" data-u="${u}" ${!db||!canWrite?"disabled":""}>Abrir y reponer</button>
      </div></article>`;
  }
  h+=`</div>`;
  const ult=REG.slice(0,5);
  h+=`<h2 class="sec">Últimos registros</h2>`+(ult.length?tablaReg(ult):`<div class="panel empty">Todavía no hay controles registrados. Empezá con <b>Abrir y reponer</b> en cada unidad para cargar el número de faja y los vencimientos.</div>`);
  return h;
}
function vVto(){
  const rows=[];
  for(const u of ORDER){const v=(ESTADO[u]||{}).vtos||{};for(const i of allItems(u)){const m=v[i.k];rows.push({u,n:i.n,sec:i.sec,m,d:diasVto(m)})}}
  rows.sort((a,b)=>(a.d===null)-(b.d===null)||(a.d??0)-(b.d??0));
  const alert=rows.filter(r=>r.d!==null&&r.d<=60),sin=rows.filter(r=>r.d===null).length;
  let h=`<h2 class="sec">Vencen en los próximos 60 días o ya vencidos</h2>`;
  h+=alert.length?`<div class="tablewrap"><table><thead><tr><th>Unidad</th><th>Ítem</th><th>Vto.</th><th>Estado</th></tr></thead><tbody>${alert.map(r=>`<tr><td>${esc(INV[r.u].nombre)}</td><td>${esc(r.n)}</td><td class="num mono">${fmtVto(r.m)}</td><td><span class="pill ${vtoClass(r.d)}">${vtoLabel(r.d)}</span></td></tr>`).join("")}</tbody></table></div>`:`<div class="panel empty">Nada vence en los próximos 60 días.</div>`;
  h+=`<h2 class="sec">Todos los ítems</h2>${sin?`<p class="muted" style="margin:0">${sin} ítems todavía sin vencimiento cargado. Se cargan al abrir y reponer cada unidad.</p>`:""}
  <div class="tablewrap"><table><thead><tr><th>Unidad</th><th>Sección</th><th>Ítem</th><th>Vto.</th><th>Estado</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(INV[r.u].nombre)}</td><td class="muted">${esc(r.sec)}</td><td>${esc(r.n)}</td><td class="num mono">${fmtVto(r.m)}</td><td><span class="pill ${vtoClass(r.d)}">${vtoLabel(r.d)}</span></td></tr>`).join("")}</tbody></table></div>`;
  return h;
}
function tablaReg(list){
  return `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Unidad</th><th>Tipo</th><th>Faja</th><th>Detalle</th><th>Responsable</th></tr></thead><tbody>${list.map(r=>{
    let det="";
    if(r.tipo==="diario"){det=r.estadoFaja==="ok"?"Faja íntegra":"<b style='color:var(--crit)'>Faja rota/no coincide</b>";if(r.equiposFalla&&r.equiposFalla.length)det+=`<br><span style="color:var(--crit)">Falla: ${esc(r.equiposFalla.join("; "))}</span>`}
    else{det=esc(r.motivo||"");if(r.faltantes&&r.faltantes.length)det+=`<br><span class="muted">Repuesto: ${esc(r.faltantes.join(", "))}</span>`}
    if(r.obs)det+=`<br><span class="muted">${esc(r.obs)}</span>`;
    const faja=r.tipo==="diario"?esc(r.faja||""):`${esc(r.fajaAnterior||"—")} → <b>${esc(r.fajaNueva||"")}</b>`;
    return `<tr><td class="num">${fmtDT(r.fecha)}</td><td>${esc(INV[r.unidad]?.nombre||r.unidad)}</td><td>${r.tipo==="diario"?"Diario":"Apertura"}</td><td class="mono num">${faja}</td><td>${det}</td><td>${esc(r.responsable||"")}</td></tr>`}).join("")}</tbody></table></div>`;
}
function vHist(){
  const list=REG.filter(r=>histFilter==="todas"||r.unidad===histFilter);
  return `<div class="toolbar"><h2 class="sec" style="margin-right:auto">Historial de controles</h2>
    <select id="histF" aria-label="Filtrar por unidad"><option value="todas">Todas las unidades</option>${ORDER.map(u=>`<option value="${u}" ${histFilter===u?"selected":""}>${esc(INV[u].nombre)}</option>`).join("")}</select>
    ${dl?`<button class="btn" data-act="csv">Descargar CSV</button>`:""}
    ${localMode?`<button class="btn" data-act="backup">Exportar respaldo</button><button class="btn" data-act="restore">Importar respaldo</button>`:""}</div>`+
    (list.length?tablaReg(list):`<div class="panel empty">Sin registros para este filtro.</div>`);
}
function vCont(){
  let h=`<p class="muted" style="margin:0">Cantidades fijas que debe tener cada unidad. <span class="prov">A CONFIRMAR</span> marca cantidades propuestas que hay que validar.</p>`;
  for(const u of ["caja1","carro"]){
    const titulo=u==="caja1"?"Cajas 1, 2 y 3 (contenido idéntico)":INV[u].nombre;
    h+=`<div class="panel"><div class="toolbar" style="justify-content:space-between"><h2 class="sec">${esc(titulo)}</h2>${canEditInv?`<button class="btn sm" data-act="editinv" data-u="${u}">Editar listado</button>`:""}</div><div class="listado">${INV[u].secciones.map(s=>`<section><h4>${esc(s.t)}</h4><ul>${s.items.map(i=>`<li><span>${esc(i.n)}${i.prov?'<span class="prov">A CONFIRMAR</span>':""}</span><span class="q2">${i.q}</span></li>`).join("")}</ul></section>`).join("")}
    ${INV[u].equipos?`<section><h4>Chequeo diario de equipos</h4><ul>${INV[u].equipos.map(e=>`<li><span>${esc(e)}</span><span class="q2">✓</span></li>`).join("")}</ul></section>`:""}</div></div>`;
  }
  return h;
}
function vComo(){
  return `<div class="panel"><h2 class="sec">Control diario (todos los turnos de apertura)</h2><ol class="steps">
  <li>Verificar que la faja de cada unidad esté íntegra y que su número coincida con el que figura en esta página.</li>
  <li>En el carro, comprobar además monitor, aspirador y descartador.</li>
  <li>Registrar con <b>Control diario</b>. Si todo está bien, no se abre nada.</li></ol></div>
  <div class="panel"><h2 class="sec">Apertura y reposición</h2><ol class="steps">
  <li>Se abre cuando la faja está rota, después de usar la unidad, cuando un ítem vence o en el control mensual.</li>
  <li>Con <b>Abrir y reponer</b>, contar cada ítem contra el listado, reponer lo que falte y cargar el vencimiento más próximo de cada ítem.</li>
  <li>Colocar una faja nueva y registrar su número. Ese número pasa a ser el de control.</li></ol></div>
  <div class="panel"><h2 class="sec">Control mensual</h2><p style="margin:0">Cada unidad se abre al menos una vez cada 31 días para revisar vencimientos. La tarjeta avisa cuando se pasa ese plazo y la pestaña Vencimientos muestra lo que vence en los próximos 60 días.</p></div>`;
}

/* ===== Hojas ===== */
function openSheet(html){const s=$("#sheet");$("#sheetInner").innerHTML=html;s.hidden=false;s.scrollTop=0;document.body.style.overflow="hidden"}
function closeSheet(){$("#sheet").hidden=true;document.body.style.overflow=""}
function respField(){return `<label class="f">Responsable <span class="hint">Nombre y apellido o iniciales + matrícula</span><input type="text" id="resp" value="${esc(lsGet("carro-resp")||"")}" autocomplete="name"></label>`}

let diarioUnits=[];
function sheetDiario(units){
  diarioUnits=units;
  let h=`<div class="sh"><h2>Control diario</h2><button class="btn" data-act="close">Cancelar</button></div>`;
  for(const u of units){
    const e=ESTADO[u]||{};
    h+=`<div class="q" data-u="${u}"><div class="qt">${esc(INV[u].nombre)} · faja <span class="mono">${esc(e.faja||"sin registrar")}</span></div>
      <div class="muted" style="font-size:13.5px">¿La faja está íntegra y el número coincide?</div>
      <div class="seg" data-q="faja"><button class="y" data-val="ok" aria-pressed="false">Sí, íntegra</button><button class="n" data-val="rota" aria-pressed="false">No</button></div>
      ${(INV[u].equipos||[]).map((eq,i)=>`<div class="muted" style="font-size:13.5px;margin-top:4px">${esc(eq)}</div><div class="seg" data-q="eq${i}"><button class="y" data-val="ok" aria-pressed="false">Sí</button><button class="n" data-val="falla" aria-pressed="false">No</button></div>`).join("")}
    </div>`;
  }
  h+=`<label class="f">Observaciones <span class="hint">Opcional</span><textarea id="obs"></textarea></label>${respField()}
  <div id="err" class="banner" hidden></div><div class="actions"><button class="btn primary" data-act="save-diario">Guardar control</button></div>`;
  openSheet(h);
}
async function saveDiario(){
  const resp=$("#resp").value.trim(),obs=$("#obs").value.trim(),err=$("#err");
  const out=[];
  for(const u of diarioUnits){
    const box=document.querySelector(`.q[data-u="${u}"]`);
    const get=q=>box.querySelector(`.seg[data-q="${q}"] [aria-pressed="true"]`)?.dataset.val;
    const f=get("faja"); if(!f){err.hidden=false;err.textContent=`Falta indicar el estado de la faja de ${INV[u].nombre}.`;return}
    const fallas=[];(INV[u].equipos||[]).forEach((eq,i)=>{const v=get("eq"+i);if(!v){fallas.push(null)}else if(v==="falla")fallas.push(eq)});
    if(fallas.includes(null)){err.hidden=false;err.textContent=`Falta responder el chequeo de equipos de ${INV[u].nombre}.`;return}
    out.push({unidad:u,tipo:"diario",estadoFaja:f,faja:(ESTADO[u]||{}).faja||"",equiposFalla:fallas,obs,responsable:resp});
  }
  if(!resp){err.hidden=false;err.textContent="Escribí quién realiza el control.";return}
  lsSet("carro-resp",resp);
  try{for(const r of out){await db.collection("registros").add({...r,fecha:new Date().toISOString(),userId:uid||null})}}
  catch(e){err.hidden=false;err.textContent="No se pudo guardar: "+(e.code==="invalid_argument"?"no tenés permiso para registrar.":e.message||e.code);return}
  closeSheet();
  const rotas=out.filter(r=>r.estadoFaja==="rota");
  toast(rotas.length?`Guardado. ${rotas.map(r=>INV[r.unidad].nombre).join(", ")}: abrir y reponer.`:"Control diario guardado.");
}

let apU=null;
function sheetApertura(u){
  apU=u; const e=ESTADO[u]||{},v=e.vtos||{};
  const dh=diarioHoy(u); const motivoDef=dh&&dh.estadoFaja==="rota"?MOTIVOS[1]:"";
  let h=`<div class="sh"><h2>Abrir y reponer · ${esc(INV[u].nombre)}</h2><button class="btn" data-act="close">Cancelar</button></div>
  <div class="q"><div class="qt">Motivo de apertura</div><div class="seg" data-q="motivo">${MOTIVOS.map(m=>`<button class="o" data-val="${esc(m)}" aria-pressed="${m===motivoDef}">${esc(m)}</button>`).join("")}</div></div>
  <div class="q"><div class="qt">Faja anterior: <span class="mono">${esc(e.faja||"sin registrar")}</span></div>
  <p class="muted" style="margin:0;font-size:13.5px">Contá cada ítem. La cantidad viene precargada con la fija: si había menos, corregila para dejar registro de lo que se repuso. Cargá el vencimiento más próximo de cada ítem.</p></div>`;
  for(const s of INV[u].secciones){
    h+=`<div class="q"><div class="qt">${esc(s.t)}</div><div class="colhead"><span>Ítem · cant. fija</span><span>Había</span><span>Vto.</span></div><div class="items">${s.items.map(i=>`<div class="it" data-k="${i.k}"><div class="nm"><b>${esc(i.n)}</b><small>Debe haber ${i.q}</small></div><input type="number" min="0" inputmode="numeric" id="q-${i.k}" value="${i.q}" aria-label="Cantidad encontrada de ${esc(i.n)}"><input type="month" id="v-${i.k}" value="${v[i.k]||""}" aria-label="Vencimiento de ${esc(i.n)}"></div>`).join("")}</div></div>`;
  }
  h+=`<div class="q"><label class="f">Número de faja nueva <span class="hint">El que queda colocado al cerrar</span><input type="text" id="fajaNueva" class="mono" inputmode="numeric" autocomplete="off"></label>
  <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="repuesto"> Repuse todo lo faltante y la unidad queda completa</label></div>
  <label class="f">Observaciones <span class="hint">Opcional</span><textarea id="obs"></textarea></label>${respField()}
  <div id="err" class="banner" hidden></div><div class="actions"><button class="btn primary" data-act="save-apertura">Cerrar con faja nueva</button></div>`;
  openSheet(h);
  document.querySelectorAll(".it input[type=number]").forEach(inp=>inp.addEventListener("input",()=>{const k=inp.closest(".it").dataset.k,i=allItems(u).find(x=>x.k===k);inp.closest(".it").classList.toggle("short",Number(inp.value)<i.q)}));
}
async function saveApertura(){
  const u=apU,err=$("#err"),show=t=>{err.hidden=false;err.textContent=t;err.scrollIntoView({block:"center"})};
  const motivo=document.querySelector('.seg[data-q="motivo"] [aria-pressed="true"]')?.dataset.val;
  const faja=$("#fajaNueva").value.trim(),resp=$("#resp").value.trim(),obs=$("#obs").value.trim();
  if(!motivo)return show("Elegí el motivo de apertura.");
  if(!faja)return show("Cargá el número de la faja nueva.");
  if(!$("#repuesto").checked)return show("Confirmá que repusiste lo faltante antes de cerrar.");
  if(!resp)return show("Escribí quién realiza la apertura.");
  const vtos={},falt=[];
  for(const i of allItems(u)){const q=Number($("#q-"+i.k).value);const m=$("#v-"+i.k).value;if(m)vtos[i.k]=m;if(q<i.q)falt.push(`${i.n} ×${i.q-q}`)}
  const now=new Date().toISOString(),prev=(ESTADO[u]||{}).faja||"";
  lsSet("carro-resp",resp);
  try{
    await db.doc("estado/"+u).set({faja,fajaFecha:now,vtos,ultimaApertura:now,actualizado:now});
    await db.collection("registros").add({unidad:u,tipo:"apertura",fecha:now,motivo,fajaAnterior:prev,fajaNueva:faja,faltantes:falt,obs,responsable:resp,userId:uid||null});
  }catch(e){return show("No se pudo guardar: "+(e.code==="invalid_argument"?"no tenés permiso para registrar.":e.message||e.code))}
  closeSheet(); toast(`${INV[u].nombre} cerrada con faja ${faja}.`);
}

function sheetEditInv(u){
  const txt=INV[u].secciones.map(s=>"# "+s.t+"\n"+s.items.map(i=>`${i.n} | ${i.q}${i.prov?" | ?":""}`).join("\n")).join("\n\n");
  openSheet(`<div class="sh"><h2>Editar listado · ${u==="caja1"?"Cajas 1–3":"Carro"}</h2><button class="btn" data-act="close">Cancelar</button></div>
  <p class="muted" style="margin:0">Una sección por bloque, empezando con <span class="mono"># Nombre</span>. Cada ítem en una línea: <span class="mono">Nombre | cantidad</span>. Agregá <span class="mono">| ?</span> para marcarlo como a confirmar. Si cambiás el nombre de un ítem se pierde su vencimiento cargado.</p>
  <textarea id="invTxt" style="min-height:420px;font-family:var(--f-mono);font-size:13px">${esc(txt)}</textarea>
  <div id="err" class="banner" hidden></div><div class="actions"><button class="btn primary" data-act="save-inv" data-u="${u}">Guardar listado</button><button class="btn" data-act="reset-inv" data-u="${u}">Volver al listado original</button></div>`);
}
function parseInv(t){
  const secs=[];let cur=null;
  for(const raw of t.split("\n")){const l=raw.trim();if(!l)continue;
    if(l.startsWith("#")){cur={t:l.replace(/^#+/,"").trim(),items:[]};secs.push(cur);continue}
    if(!cur){cur={t:"General",items:[]};secs.push(cur)}
    const p=l.split("|").map(x=>x.trim());const q=parseInt(p[1],10);
    if(!p[0]||isNaN(q))throw new Error(`Línea sin cantidad válida: "${l}"`);
    cur.items.push(it(p[0],q,p[2]==="?"));}
  if(!secs.length)throw new Error("El listado está vacío.");return secs;
}
async function saveInv(u,reset){
  const err=$("#err");let secs;
  try{secs=reset?structuredClone(DEFAULT_INV[u].secciones):parseInv($("#invTxt").value)}catch(e){err.hidden=false;err.textContent=e.message;return}
  const units=u==="caja1"?["caja1","caja2","caja3"]:["carro"];
  const data={};for(const k of ORDER)data[k]={secciones:INV[k].secciones};for(const k of units)data[k]={secciones:structuredClone(secs)};
  try{await db.doc("config/inventario").set({units:data,actualizado:new Date().toISOString()})}catch(e){err.hidden=false;err.textContent="No se pudo guardar el listado.";return}
  closeSheet();toast("Listado actualizado.");
}

/* ===== Eventos ===== */
function bindMain(){const f=$("#histF");if(f)f.onchange=()=>{histFilter=f.value;render()}}
document.addEventListener("click",e=>{
  const t=e.target.closest("button");if(!t)return;
  if(t.closest("#tabs")){view=t.dataset.v;render();return}
  const seg=t.closest(".seg");if(seg){seg.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b===t));return}
  const a=t.dataset.act;
  if(a==="diario-todas")sheetDiario(ORDER);
  else if(a==="diario")sheetDiario([t.dataset.u]);
  else if(a==="apertura")sheetApertura(t.dataset.u);
  else if(a==="close")closeSheet();
  else if(a==="save-diario")saveDiario();
  else if(a==="save-apertura")saveApertura();
  else if(a==="editinv")sheetEditInv(t.dataset.u);
  else if(a==="save-inv")saveInv(t.dataset.u,false);
  else if(a==="reset-inv")saveInv(t.dataset.u,true);
  else if(a==="csv")downloadCSV();
  else if(a==="backup")exportBackup();
  else if(a==="restore")importBackup();
});
let tt;function toast(m){const el=$("#toast");el.textContent=m;el.hidden=false;clearTimeout(tt);tt=setTimeout(()=>el.hidden=true,4000)}
async function downloadCSV(){
  const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';
  const rows=[["Fecha","Unidad","Tipo","Estado faja","Faja","Faja anterior","Faja nueva","Motivo","Repuesto","Fallas equipos","Observaciones","Responsable"]];
  for(const r of REG)rows.push([fmtDT(r.fecha),INV[r.unidad]?.nombre||r.unidad,r.tipo,r.estadoFaja||"",r.faja||"",r.fajaAnterior||"",r.fajaNueva||"",r.motivo||"",(r.faltantes||[]).join("; "),(r.equiposFalla||[]).join("; "),r.obs||"",r.responsable||""]);
  const csv="﻿"+rows.map(r=>r.map(q).join(";")).join("\r\n");
  try{await dl.save({filename:`control-carro-paro-${dayKey()}.csv`,data:new Blob([csv],{type:"text/csv"})})}catch(e){toast("No se descargó el archivo.")}
}

/* ===== Respaldo (modo local) ===== */
async function exportBackup(){
  try{await dl.save({filename:`respaldo-carro-paro-${dayKey()}.json`,data:new Blob([localBackend.exportJSON()],{type:"application/json"})})}catch(e){toast("No se pudo exportar.")}
}
function importBackup(){
  const inp=document.createElement("input");inp.type="file";inp.accept="application/json,.json";
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
    if(!confirm("Importar el respaldo reemplaza todos los datos guardados en este navegador. ¿Continuar?"))return;
    try{localBackend.importJSON(await f.text());toast("Respaldo importado.")}catch(e){toast("El archivo no es un respaldo válido.")}};
  inp.click();
}

/* ===== Arranque ===== */
render();
(async()=>{
  try{
    if(typeof claude==="undefined")throw new Error("sin runtime de Claude");
    [db,user,dl]=await Promise.all([claude.use("db"),claude.use("user"),claude.use("downloads")]);
  }catch(e){
    // Fuera de claude.ai (p. ej. GitHub Pages): guardar en este navegador
    try{localStorage.length;({db,user,downloads:dl}=window.localBackend);localMode=true}catch(e2){db=null}
  }
  if(user){try{uid=await user.id()}catch(e){}try{const w=await user.can("data.write");canWrite=w!==false}catch(e){}try{canEditInv=!!(await user.canEdit())}catch(e){}}
  dbReady=true;
  if(!db){render();return}
  db.doc("config/inventario").onSnapshot(s=>{
    INV=structuredClone(DEFAULT_INV);
    const d=s.exists&&s.data();if(d&&d.units)for(const k of ORDER)if(d.units[k]&&Array.isArray(d.units[k].secciones))INV[k].secciones=structuredClone(d.units[k].secciones);
    render();
  },()=>{});
  db.collection("estado").onSnapshot(s=>{ESTADO={};s.docs.forEach(d=>ESTADO[d.id]=d.data());render()},()=>{});
  db.collection("registros").orderBy("fecha","desc").limit(500).onSnapshot(s=>{REG=s.docs.map(d=>({id:d.id,...d.data()}));render()},()=>{});
  render();
})();
