const $=(s)=>document.querySelector(s);
const $$=(s)=>document.querySelectorAll(s);
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

// Cursor
const cursor=$(".cursor"), dot=$(".cursor-dot");
if(!matchMedia("(pointer:coarse)").matches){
  addEventListener("pointermove",e=>{
    dot.style.left=e.clientX+"px";dot.style.top=e.clientY+"px";
    cursor.animate({left:e.clientX+"px",top:e.clientY+"px"},{duration:400,fill:"forwards",easing:"cubic-bezier(.16,1,.3,1)"});
  });
  $$("a,button,.magnetic").forEach(el=>{
    el.addEventListener("mouseenter",()=>cursor.classList.add("big"));
    el.addEventListener("mouseleave",()=>{cursor.classList.remove("big");el.style.transform=""});
    if(el.classList.contains("magnetic"))el.addEventListener("pointermove",e=>{
      const r=el.getBoundingClientRect();
      el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.1}px,${(e.clientY-r.top-r.height/2)*.1}px)`;
    });
  });
}

// Menu
const drawer=$(".drawer"),menu=$(".menu"),close=$(".close");
function setMenu(open){drawer.classList.toggle("open",open);drawer.setAttribute("aria-hidden",String(!open));menu.setAttribute("aria-expanded",String(open));document.body.style.overflow=open?"hidden":""}
menu.addEventListener("click",()=>setMenu(true));close.addEventListener("click",()=>setMenu(false));
$$(".drawer a").forEach(a=>a.addEventListener("click",()=>setMenu(false)));

// Scroll
const paintings=$$(".painting"), wires=$$(".wire");
addEventListener("scroll",()=>{
  const y=scrollY,max=document.documentElement.scrollHeight-innerHeight,p=max?y/max:0;
  $(".progress span").style.transform=`scaleX(${p})`;
  if(reduce)return;
  paintings.forEach((el,i)=>{
    const offset=(i-paintings.length/2)*9;
    el.style.transform=`scale(${1.08+p*.12}) translate3d(${Math.sin(p*Math.PI*2+i)*offset}px,${p*-35+offset}px,0)`;
  });
  wires.forEach((el,i)=>{
    el.style.transform=`rotate(${25+i*18+p*65}deg) translate3d(${Math.sin(p*8+i)*25}px,${Math.cos(p*5+i)*20}px,0)`;
  });
},{passive:true});

// Give each artwork layer a different reveal as sections pass
const sections=[...$$("main section")];
const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const idx=Math.max(0,sections.indexOf(entry.target));
    paintings.forEach((p,i)=>p.style.opacity=i===idx%paintings.length?".42":i===(idx+1)%paintings.length?".08":"0");
  });
},{threshold:.28});
sections.forEach(s=>observer.observe(s));

// Subtle initial reveal
requestAnimationFrame(()=>document.body.classList.add("ready"));
