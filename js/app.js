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
 caja1:{nombre:"Caja 1",tipo:"Caja de emergencia",secciones:CAJA(), nivel:"faja"},
 caja2:{nombre:"Caja 2",tipo:"Caja de emergencia",secciones:CAJA(), nivel:"faja"},
 caja3:{nombre:"Caja 3",tipo:"Caja de emergencia",secciones:CAJA(), nivel:"faja"},
 carro:{nombre:"Carro de paro · Guardias Nacionales",tipo:"Carro (sala de recuperación)",secciones:[
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
let modo=lsGet("carro-modo")||"control"; // control | coord
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&","<":"<",">":">","\"":"""}[c]));
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
  const tabs=$("#tabs");
  if(modo==="control"){
    tabs.style.display="none";
  }else{
    tabs.style.display="";
    document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.v===view));
  }
  const n=vtoAlertCount(),bd=$("#vtoBadge"); bd.hidden=!n; bd.textContent=n;
  const m=$("#main"); let h="";
  // Toggle de modo
  h+=`<div class="toolbar" style="justify-content:flex-end;margin-bottom:8px"><button class="btn sm" data-act="toggle-modo">${modo==="control"?"Ver modo coordinación":"Ver modo control"}</button></div>`;
  if(!dbReady) h+=`<div class="banner info">Conectando con el registro compartido…</div>`;
  else if(!db) h+=`<div class="banner">No se pudo acceder al almacenamiento de este navegador. Revisá que no esté en modo privado ni con los datos de sitios bloqueados.</div>`;
  else if(localMode) h+=`<div class="banner info">Modo local: los controles se guardan solo en este navegador. Usá <b>Exportar respaldo</b> en Historial para no perderlos.</div>`;
  else if(!canWrite) h+=`<div class="banner">Tenés acceso de solo lectura. Pedile a la coordinación que te dé permiso de Colaborador para registrar controles.</div>`;
  if(modo==="control"){
    h+=vControl();
  }else{
    if(view==="hoy")h+=vHoy(); if(view==="vto")h+=vVto(); if(view==="hist")h+=vHist(); if(view==="cont")h+=vCont(); if(view==="qr")h+=vQR(); if(view==="como")h+=vComo();
  }
  m.innerHTML=h; bindMain();
}

function vControl(){
  let h=`<div class="toolbar" style="justify-content:space-between"><h2 class="sec">Control diario de fajas</h2></div>
  <p class="muted" style="margin:0 0 12px">Escaneá el QR de la unidad o tocá la tarjeta para verificar si la faja está íntegra.</p>
  <div class="grid">`;
  for(const u of ORDER){
    const e=ESTADO[u]||{},s=unitStatus(u),dh=diarioHoy(u);
    const statusTxt = dh ? (dh.estadoFaja==="ok"?"Controlada hoy":"Problema hoy") : "Pendiente";
    h+=`<article class="unit ${s.c}" style="cursor:pointer" data-act="qr-control" data-u="${u}">
      <div class="head"><h3>${esc(INV[u].nombre)}</h3><span class="kind">${esc(INV[u].tipo)}</span></div>
      <span class="pill ${s.pill[0]}">${s.pill[1]}</span>
      <div class="faja">${e.faja?esc(e.faja):"———"}<small>Faja vigente</small></div>
      <div style="font-size:14px;font-weight:700;margin-top:4px">${statusTxt}</div>
    </article>`;
  }
  h+=`</div>
  <div class="panel" style="margin-top:16px"><h2 class="sec">Cómo controlar</h2><ol class="steps">
    <li>Escaneá el código QR pegado en la caja o carro.</li>
    <li>Verificá visualmente que la faja esté íntegra y el número coincida.</li>
    <li>Tocá <b>Sí, íntegra</b> o <b>No / rota</b> y confirmá.</li>
  </ol></div>`;
  return h;
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
    if(r.tipo==="diario"){det=r.estadoFaja==="ok"?"Faja íntegra":"<b style='color:var(--crit)'>Faja rota/no coincide</b>";if(r.via==="qr")det+=` <span class="muted">· por QR</span>`;if(r.equiposFalla&&r.equiposFalla.length)det+=`<br><span style="color:var(--crit)">Falla: ${esc(r.equiposFalla.join("; "))}</span>`}
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
  return `<div class="panel"><h2 class="sec">Control diario con QR (técnicos y personal de apoyo)</h2><ol class="steps">
  <li>Imprimir las etiquetas desde <b>Códigos QR</b> y pegar cada una en su unidad (caja o carro).</li>
  <li>Escanear con la cámara del celular. Si ya se controló hoy, se muestra la confirmación en verde.</li>
  <li>Si está pendiente: verificar visualmente que la faja esté íntegra y que el número coincida con el que se muestra, y tocar <b>Sí, íntegra</b> o <b>No / rota</b>. No hace falta contar medicamentos ni abrir.</li>
  <li>Si la faja está rota o no coincide, queda marcado para que enfermería abra y reponga.</li></ol></div>
  <div class="panel"><h2 class="sec">Control completo (enfermería)</h2><ol class="steps">
  <li>En las áreas con enfermería y en el carro de Guardias Nacionales, además de la faja se puede hacer el control completo de equipos y, cuando corresponda, abrir y reponer.</li>
  <li>La apertura se usa cuando la faja está rota, después de un uso real, por vencimiento o en el control mensual.</li></ol></div>
  <div class="panel"><h2 class="sec">Apertura y reposición</h2><ol class="steps">
  <li>Se abre cuando la faja está rota, después de usar la unidad, cuando un ítem vence o en el control mensual.</li>
  <li>Con <b>Abrir y reponer</b>, contar cada ítem contra el listado, reponer lo que falte y cargar el vencimiento más próximo de cada ítem.</li>
  <li>Colocar una faja nueva y registrar su número. Ese número pasa a ser el de control.</li></ol></div>
  <div class="panel"><h2 class="sec">Control mensual</h2><p style="margin:0">Cada unidad se abre al menos una vez cada 31 días para revisar vencimientos. La tarjeta avisa cuando se pasa ese plazo y la pestaña Vencimientos muestra lo que vence en los próximos 60 días.</p></div>`;
}

/* ===== Códigos QR ===== */
function qrURL(u){return location.origin+location.pathname+"?u="+u}
function qrSVG(text){const q=qrcode(0,"M");q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true})}
function vQR(){
  if(location.protocol==="file:")return `<div class="banner">Los códigos QR necesitan que la app esté publicada (por ejemplo en GitHub Pages). Abrila desde su dirección web para generarlos.</div>`;
  return `<div class="toolbar noprint" style="justify-content:space-between"><h2 class="sec">Etiquetas para pegar en cada unidad</h2><button class="btn primary" data-act="print">Imprimir etiquetas</button></div>
  <p class="muted noprint" style="margin:0">Al escanear la etiqueta con la cámara del celular se abre el control diario de esa unidad. Si ya fue controlada hoy, muestra la confirmación con hora y responsable.</p>
  <div class="qrgrid">${ORDER.map(u=>`<div class="qrlabel">${qrSVG(qrURL(u))}<h3><span class="plus">✪</span> ${esc(INV[u].nombre)}</h3><p>Escaneá para registrar el control diario</p></div>`).join("")}</div>`;
}
let qrU=null;
function sheetQR(u){
  qrU=u; const e=ESTADO[u]||{},dh=diarioHoy(u),nombre=esc(INV[u].nombre);
  let h=`<div class="sh"><h2>${nombre}</h2><button class="btn" data-act="close">Ir al tablero</button></div>`;
  if(dh){
    const ok=dh.estadoFaja==="ok"&&!(dh.equiposFalla||[]).length;
    h+=`<div class="qrdone ${ok?"":"bad"}"><div class="big">${ok?"✓":"!"}</div><h3>${ok?"Controlada hoy":"Controlada hoy con problemas"}</h3>
      <div>${fmtDT(dh.fecha).split(" ")[1]} hs · ${esc(dh.responsable||"")}</div>
      <div>Faja <b class="mono">${esc(dh.faja||"—")}</b> ${dh.estadoFaja==="ok"?"íntegra":"<b>rota o no coincide</b>"}</div>
      ${(dh.equiposFalla||[]).length?`<div><b>Falla:</b> ${esc(dh.equiposFalla.join("; "))}</div>`:""}</div>
      <div class="actions">${ok?"":`<button class="btn danger" data-act="apertura" data-u="${u}">Abrir y reponer</button>`}<button class="btn" data-act="qr-otra">Registrar otro control</button></div>`;
    return openSheet(h);
  }
  if(!e.faja){
    h+=`<div class="qrdone bad"><div class="big">!</div><h3>Sin faja registrada</h3><div>Antes del primer control hay que abrir la unidad, reponer y cargar el número de faja.</div></div>
      <div class="actions"><button class="btn primary" data-act="apertura" data-u="${u}">Abrir y reponer</button></div>`;
    return openSheet(h);
  }
  qrForm(u,h);
}
function qrForm(u,h){
  qrU=u; h=h||`<div class="sh"><h2>${esc(INV[u].nombre)}</h2><button class="btn" data-act="close">Ir al tablero</button></div>`;
  diarioUnits=[u];
  const e = ESTADO[u]||{};
  const esFajaSimple = INV[u].nivel === "faja";
  h+=`<div class="q" data-u="${u}"><div class="qt">Control diario · pendiente hoy</div>
    <div style="font-size:15px;margin-bottom:6px">Faja registrada: <b class="mono">${esc(e.faja||"—")}</b></div>
    <div class="muted" style="font-size:14px">Verificá visualmente que el número coincida y que la faja esté íntegra (sin cortes ni despegada).</div>
    <div class="seg" data-q="faja" style="margin-top:8px"><button class="y" data-val="ok" aria-pressed="false">Sí, íntegra</button><button class="n" data-val="rota" aria-pressed="false">No / rota</button></div>
    ${!esFajaSimple && (INV[u].equipos||[]).length ? (INV[u].equipos||[]).map((eq,i)=>`<div class="muted" style="font-size:13.5px;margin-top:8px">${esc(eq)}</div><div class="seg" data-q="eq${i}"><button class="y" data-val="ok" aria-pressed="false">Sí</button><button class="n" data-val="falla" aria-pressed="false">No</button></div>`).join("") : ""}
  </div>${respField()}
  <div id="err" class="banner" hidden></div><div class="actions"><button class="btn primary" data-act="save-diario">Confirmar control</button></div>`;
  openSheet(h);
}

/* ===== Hojas ===== */
function openSheet(html){const s=$("#sheet");$("#sheetInner").innerHTML=html;s.hidden=false;s.scrollTop=0;document.body.style.overflow="hidden"}
function closeSheet(){$("#sheet").hidden=true;document.body.style.overflow="";
  if(qrU){qrU=null;try{history.replaceState(null,"",location.pathname)}catch(e){}}}
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
  const resp=$("#resp").value.trim(),obs=($("#obs")?.value||"").trim(),err=$("#err");
  const out=[];
  for(const u of diarioUnits){
    const box=document.querySelector(`.q[data-u="${u}"]`);
    const get=q=>box.querySelector(`.seg[data-q="${q}"] [aria-pressed="true"]`)?.dataset.val;
    let f=get("faja"); if(!f){err.hidden=false;err.textContent=`Falta indicar el estado de la faja de ${INV[u].nombre}.`;return}
    const vista=box.querySelector("#fajaVista"),obsQR=[];
    if(vista){const v=vista.value.trim();
      if(v && v.replace(/\s/g,"").toUpperCase()!==String((ESTADO[u]||{}).faja||"").replace(/\s/g,"").toUpperCase()){f="rota";obsQR.push(`Faja leída ${v} no coincide con la registrada`)}}
    const fallas=[];(INV[u].equipos||[]).forEach((eq,i)=>{const v=get("eq"+i);if(!v){fallas.push(null)}else if(v==="falla")fallas.push(eq)});
    if(fallas.includes(null)){err.hidden=false;err.textContent=`Falta responder el chequeo de equipos de ${INV[u].nombre}.`;return}
    out.push({unidad:u,tipo:"diario",estadoFaja:f,faja:(ESTADO[u]||{}).faja||"",equiposFalla:fallas,obs:[...obsQR,obs].filter(Boolean).join(". "),responsable:resp,...(vista?{via:"qr"}:{})});
  }
  if(!resp){err.hidden=false;err.textContent="Escribí quién realiza el control.";return}
  lsSet("carro-resp",resp);
  try{for(const r of out){await db.collection("registros").add({...r,fecha:new Date().toISOString(),userId:uid||null})}}
  catch(e){err.hidden=false;err.textContent="No se pudo guardar: "+(e.code==="invalid_argument"?"no tenés permiso para registrar.":e.message||e.code);return}
  if(qrU){if(!diarioHoy(qrU))REG=[...out.map(r=>({...r,fecha:new Date().toISOString()})),...REG];sheetQR(qrU);return}
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
  <div class="q"><div class="qt">Conteo y vencimientos</div>
    <div class="colhead"><span>Ítem</span><span>Cant.</span><span>Vto.</span></div>
    <div class="items">${allItems(u).map(i=>`<div class="it" data-k="${i.k}"><div class="nm"><b>${esc(i.n)}</b><small>${esc(i.sec)}${i.prov?' <span class="prov">A CONFIRMAR</span>':""}</small></div><input type="number" min="0" value="${i.q}" class="qty"><input type="month" value="${v[i.k]||""}" class="vto"></div>`).join("")}</div>
  </div>
  <label class="f">Número de faja nueva<input type="text" id="fajaNueva" class="mono" inputmode="numeric" autocomplete="off"></label>
  <label class="f">Observaciones <span class="hint">Opcional</span><textarea id="obs"></textarea></label>${respField()}
  <div id="err" class="banner" hidden></div><div class="actions"><button class="btn primary" data-act="save-apertura">Guardar apertura</button></div>`;
  openSheet(h);
}
async function saveApertura(){
  const resp=$("#resp").value.trim(),obs=$("#obs").value.trim(),err=$("#err"),fajaNueva=$("#fajaNueva").value.trim();
  const motivo=document.querySelector(".seg[data-q=motivo] [aria-pressed=true]")?.dataset.val;
  if(!motivo){err.hidden=false;err.textContent="Elegí el motivo de apertura.";return}
  if(!fajaNueva){err.hidden=false;err.textContent="Escribí el número de la faja nueva.";return}
  if(!resp){err.hidden=false;err.textContent="Escribí quién realiza el control.";return}
  const items=[],faltantes=[],vtos={};
  document.querySelectorAll(".it").forEach(it=>{
    const k=it.dataset.k,q=parseInt(it.querySelector(".qty").value,10)||0,m=it.querySelector(".vto").value;
    const def=allItems(apU).find(i=>i.k===k);
    items.push({k,q,vto:m||null});
    if(q<def.q)faltantes.push(def.n);
    if(m)vtos[k]=m;
  });
  lsSet("carro-resp",resp);
  const e=ESTADO[apU]||{};
  try{
    await db.collection("registros").add({unidad:apU,tipo:"apertura",motivo,fajaAnterior:e.faja||"",fajaNueva,faltantes,items,obs,responsable:resp,fecha:new Date().toISOString(),userId:uid||null});
    await db.doc("estado/"+apU).set({faja:fajaNueva,fajaFecha:new Date().toISOString(),ultimaApertura:new Date().toISOString(),vtos});
  }catch(ex){err.hidden=false;err.textContent="No se pudo guardar: "+(ex.message||ex.code);return}
  closeSheet();
  toast("Apertura guardada. Faja nueva registrada.");
}

/* ===== Inventario editable ===== */
function sheetEditInv(u){
  let h=`<div class="sh"><h2>Editar listado · ${esc(INV[u].nombre)}</h2><button class="btn" data-act="close">Cancelar</button></div>
  <p class="muted" style="margin:0">Editá nombres y cantidades. Las cajas 1-3 comparten el mismo listado.</p>`;
  for(const s of INV[u].secciones){
    h+=`<div class="q" data-sec="${esc(s.t)}"><div class="qt">${esc(s.t)}</div><div class="items">${s.items.map(i=>`<div class="it"><div class="nm"><input type="text" value="${esc(i.n)}" class="inm"></div><input type="number" min="0" value="${i.q}" class="qty"></div>`).join("")}</div></div>`;
  }
  h+=`<div class="actions"><button class="btn primary" data-act="save-inv" data-u="${u}">Guardar listado</button></div>`;
  openSheet(h);
}
async function saveInv(u){
  const secciones=[];
  document.querySelectorAll(".q[data-sec]").forEach(sec=>{
    const t=sec.dataset.sec,items=[];
    sec.querySelectorAll(".it").forEach(it=>{
      const n=it.querySelector(".inm").value.trim(),q=parseInt(it.querySelector(".qty").value,10)||0;
      if(n)items.push({k:slug(n),n,q,prov:false});
    });
    if(items.length)secciones.push({t,items});
  });
  const units={};
  for(const k of ORDER)units[k]={secciones:k===u||(u==="caja1"&&k.startsWith("caja"))?secciones:INV[k].secciones};
  try{await db.doc("config/inventario").set({units});closeSheet();toast("Listado actualizado.")}
  catch(e){toast("No se pudo guardar el listado.")}
}

/* ===== Acciones ===== */
function bindMain(){
  document.querySelectorAll("[data-act]").forEach(b=>b.onclick=ev=>{
    const a=b.dataset.act,u=b.dataset.u;
    if(a==="diario")sheetDiario([u]);
    if(a==="diario-todas")sheetDiario(ORDER.filter(x=>!diarioHoy(x)));
    if(a==="apertura")sheetApertura(u);
    if(a==="editinv")sheetEditInv(u);
    if(a==="print")window.print();
    if(a==="csv")exportCSV();
    if(a==="backup")exportBackup();
    if(a==="restore")importBackup();
    if(a==="toggle-modo"){
      modo = modo==="control"?"coord":"control";
      lsSet("carro-modo",modo);
      render();
    }
    if(a==="qr-control")sheetQR(u);
  });
  const hf=$("#histF"); if(hf)hf.onchange=()=>{histFilter=hf.value;render()};
}
function bindSheet(){
  document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{
    b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));
    b.setAttribute("aria-pressed","true");
  });
  document.querySelectorAll("[data-act=close]").forEach(b=>b.onclick=closeSheet);
  document.querySelectorAll("[data-act=save-diario]").forEach(b=>b.onclick=saveDiario);
  document.querySelectorAll("[data-act=save-apertura]").forEach(b=>b.onclick=saveApertura);
  document.querySelectorAll("[data-act=save-inv]").forEach(b=>b.onclick=()=>saveInv(b.dataset.u));
  document.querySelectorAll("[data-act=qr-otra]").forEach(b=>b.onclick=()=>{diarioHoy=()=>null;sheetQR(qrU)});
  document.querySelectorAll("[data-act=apertura]").forEach(b=>b.onclick=()=>sheetApertura(b.dataset.u||qrU));
}
const _open=openSheet; openSheet=html=>{_open(html);bindSheet()};

function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;setTimeout(()=>t.hidden=true,2800)}

async function exportCSV(){
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=[["Fecha","Unidad","Tipo","Faja","Detalle","Responsable"]].concat(REG.map(r=>{
    let det=r.tipo==="diario"?(r.estadoFaja==="ok"?"Íntegra":"Rota"):(r.motivo||"");
    if(r.faltantes&&r.faltantes.length)det+=" | "+r.faltantes.join(", ");
    return [fmtDT(r.fecha),INV[r.unidad]?.nombre||r.unidad,r.tipo,r.tipo==="diario"?r.faja:((r.fajaAnterior||"")+" → "+(r.fajaNueva||"")),det,r.responsable||""];
  }));
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
  let qrPend=new URLSearchParams(location.search).get("u");
  if(qrPend){modo="control";lsSet("carro-modo","control");}
  db.collection("registros").orderBy("fecha","desc").limit(500).onSnapshot(s=>{REG=s.docs.map(d=>({id:d.id,...d.data()}));render();
    if(qrPend&&INV[qrPend]){const u=qrPend;qrPend=null;setTimeout(()=>sheetQR(u),0)}},()=>{});
  render();
})();
