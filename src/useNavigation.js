import {useEffect, useRef, useState} from 'react';
import {createNavigation} from './navigation.mjs';

export function useNavigation(subscriptions) {
  const [view,setView]=useState({tab:'overview',modal:null});
  const navigation=useRef(null);
  useEffect(()=>{
    const controller=createNavigation(window.history,setView);
    navigation.current=controller;
    const pop=event=>controller.onPop(event.state);
    window.addEventListener('popstate',pop);
    return()=>window.removeEventListener('popstate',pop);
  },[]);
  const edit=view.modal?.id ? subscriptions.find(sub=>sub.id===view.modal.id) : null;
  const modal=view.modal && (!view.modal.id || edit) ? {type:view.modal.type,...(edit?{sub:edit}:{})} : null;
  const setModal=next=>navigation.current?.setModal(next ? {type:next.type,...(next.sub?{id:next.sub.id}:{})} : null);
  const setTab=tab=>navigation.current?.setTab(tab);
  return [view.tab,setTab,modal,setModal];
}
