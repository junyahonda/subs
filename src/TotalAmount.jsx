import {useLayoutEffect, useRef} from 'react';

export function TotalAmount({value}) {
  const amount=useRef(null);
  useLayoutEffect(()=>{
    const node=amount.current;
    let active=true,lastWidth=0;
    const fit=()=>{
      if(!active)return;
      // Start at the responsive CSS size; shrink the exact value, never round it.
      node.style.fontSize='';
      const size=parseFloat(getComputedStyle(node).fontSize);
      const available=node.clientWidth;
      if(available && node.scrollWidth>available) {
        node.style.fontSize=`${Math.max(12,Math.floor(size*available/node.scrollWidth))}px`;
      }
    };
    const observer=new ResizeObserver(([entry])=>{
      if(entry.contentRect.width!==lastWidth){lastWidth=entry.contentRect.width;fit();}
    });
    observer.observe(node.parentElement);
    fit();
    document.fonts.ready.then(fit);
    return()=>{active=false;observer.disconnect();};
  },[value]);
  return <span ref={amount} className="total-amount">{value}</span>;
}
