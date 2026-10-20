/* ===== Almacenamiento local =====
   Reemplazo de claude.use("db" | "user" | "downloads") cuando la app se abre
   fuera de claude.ai (por ejemplo, desde GitHub Pages). Implementa solo la
   parte de la API que usa app.js y guarda todo en localStorage de este
   navegador: los datos NO se comparten entre dispositivos. */
(function(){
  const KEY="carro-paro-cima-db";
  const listeners=new Set();
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
  function save(d){
    try{localStorage.setItem(KEY,JSON.stringify(d))}
    catch(e){const err=new Error("No hay espacio o el navegador bloquea el almacenamiento local.");err.code="storage";throw err}
    notify();
  }
  function notify(){listeners.forEach(fn=>{try{fn()}catch(e){}})}
  window.addEventListener("storage",e=>{if(e.key===KEY)notify()});
  const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

  function docSnap(id,data){return{id,exists:data!==undefined,data:()=>structuredClone(data)}}
  function watch(fn){listeners.add(fn);fn();return()=>listeners.delete(fn)}

  function doc(path){
    const [col,id]=path.split("/");
    return{
      async set(data){const d=load();(d[col]=d[col]||{})[id]=structuredClone(data);save(d)},
      onSnapshot(cb){return watch(()=>cb(docSnap(id,(load()[col]||{})[id])))}
    };
  }
  function query(col,order,max){
    return{
      orderBy(field,dir="asc"){return query(col,{field,dir},max)},
      limit(n){return query(col,order,n)},
      async add(data){const d=load(),id=newId();(d[col]=d[col]||{})[id]=structuredClone(data);save(d);return{id}},
      onSnapshot(cb){return watch(()=>{
        let docs=Object.entries(load()[col]||{}).map(([id,v])=>docSnap(id,v));
        if(order){const s=order.dir==="desc"?-1:1;docs.sort((a,b)=>{const x=a.data()[order.field],y=b.data()[order.field];return x<y?-s:x>y?s:0})}
        if(max)docs=docs.slice(0,max);
        cb({docs});
      })}
    };
  }
  const db={doc,collection:c=>query(c)};
  const user={id:async()=>"local",can:async()=>true,canEdit:async()=>true};
  const downloads={async save({filename,data}){
    const url=URL.createObjectURL(data),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }};

  window.localBackend={
    db,user,downloads,
    exportJSON:()=>JSON.stringify(load(),null,2),
    importJSON(txt){const d=JSON.parse(txt);if(typeof d!=="object"||!d)throw new Error("Archivo inválido");save(d)}
  };
})();
