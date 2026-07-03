(function(){
  "use strict";
  document.addEventListener("DOMContentLoaded",function(){
    var menu=document.getElementById("mobileMenu"), open=document.getElementById("menuToggle"), close=document.getElementById("menuClose");
    function set(v){menu.classList.toggle("is-open",v);menu.setAttribute("aria-hidden",String(!v));open.setAttribute("aria-expanded",String(v));}
    open.addEventListener("click",function(){set(true);});
    close.addEventListener("click",function(){set(false);});
    menu.addEventListener("click",function(e){if(e.target.matches("[data-route]")) set(false);});
    document.addEventListener("keydown",function(e){if(e.key==="Escape") set(false);});
  });
})();
