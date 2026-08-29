(function(){
  'use strict';

  var ROOT_SELECTOR='.entry-content';
  var IMAGE_RE=/\/(?:30w|60w|zpu|pdf|big)\//i;
  var MIN_IMAGES=2;

  function isPreviewImage(img){
    return img&&img.tagName==='IMG'&&IMAGE_RE.test(img.currentSrc||img.getAttribute('src')||'');
  }

  function cleanText(value){
    return String(value||'').replace(/\s+/g,' ').trim();
  }

  function groupsFromContainer(container){
    var nodes=Array.prototype.slice.call(container.childNodes);
    var first=nodes.findIndex(function(node){return node.nodeType===1&&isPreviewImage(node);});
    if(first<0) return null;
    var groups=[],removable=[],current=null;
    for(var i=first;i<nodes.length;i++){
      var node=nodes[i];
      if(node.nodeType===1&&isPreviewImage(node)){
        current={img:node,text:[]};
        groups.push(current);
        removable.push(node);
      }else if(current&&(node.nodeType===3||node.nodeName==='BR')){
        if(node.nodeType===3) current.text.push(node.nodeValue);
        removable.push(node);
      }else{
        break;
      }
    }
    if(groups.length<MIN_IMAGES) return null;
    return {groups:groups,insertBefore:container,container:container,removable:removable};
  }

  function groupsFromDirectNodes(root){
    var nodes=Array.prototype.slice.call(root.childNodes);
    var first=nodes.findIndex(function(node){return node.nodeType===1&&isPreviewImage(node);});
    if(first<0) return null;
    var groups=[],removable=[],current=null;
    for(var i=first;i<nodes.length;i++){
      var node=nodes[i];
      if(node.nodeType===1&&isPreviewImage(node)){
        current={img:node,text:[]};groups.push(current);removable.push(node);continue;
      }
      if(current&&(node.nodeType===3||node.nodeName==='BR')){
        if(node.nodeType===3) current.text.push(node.nodeValue);
        removable.push(node);continue;
      }
      break;
    }
    if(groups.length<MIN_IMAGES) return null;
    return {groups:groups,insertBefore:groups[0].img,container:null,removable:removable};
  }

  function findSource(root){
    var containers=Array.prototype.slice.call(root.children).filter(function(el){
      if(!el.querySelectorAll||/^(SCRIPT|STYLE|NOSCRIPT)$/i.test(el.tagName)) return false;
      return Array.prototype.filter.call(el.children,isPreviewImage).length>=MIN_IMAGES;
    });
    if(containers.length) return groupsFromContainer(containers[0]);
    return groupsFromDirectNodes(root);
  }

  function button(className,label,html){
    var el=document.createElement('button');
    el.type='button';el.className=className;el.setAttribute('aria-label',label);el.innerHTML=html;
    return el;
  }

  function buildGallery(source,index){
    var gallery=document.createElement('section');
    gallery.className='fzpg-gallery';
    gallery.setAttribute('aria-label','内容图片预览');
    gallery.dataset.fzpgIndex=String(index);

    var stage=document.createElement('div');stage.className='fzpg-stage';stage.tabIndex=0;
    var loading=document.createElement('span');loading.className='fzpg-loading';loading.setAttribute('aria-hidden','true');
    var main=document.createElement('img');main.className='fzpg-main-image';main.draggable=false;main.loading='eager';
    var error=document.createElement('span');error.className='fzpg-error';error.textContent='图片暂时无法加载';error.hidden=true;
    var prev=button('fzpg-arrow fzpg-prev','上一张图片','&#8249;');
    var next=button('fzpg-arrow fzpg-next','下一张图片','&#8250;');
    var counter=document.createElement('span');counter.className='fzpg-counter';counter.setAttribute('aria-live','polite');
    stage.append(loading,main,error,prev,next,counter);gallery.appendChild(stage);

    var captions=document.createElement('div');captions.className='fzpg-captions';
    source.groups.forEach(function(group,i){
      var value=cleanText(group.text.join(' '));
      var wrap=document.createElement('div');wrap.className='fzpg-caption';wrap.hidden=i!==0||!value;
      var text=document.createElement('div');text.className='fzpg-caption-text';text.textContent=value;
      var toggle=button('fzpg-caption-toggle','展开图片说明','展开说明');
      if(value.length<85) toggle.hidden=true;
      toggle.addEventListener('click',function(){
        var open=wrap.classList.toggle('is-open');
        toggle.textContent=open?'收起说明':'展开说明';
        toggle.setAttribute('aria-label',open?'收起图片说明':'展开图片说明');
      });
      wrap.append(text,toggle);captions.appendChild(wrap);
    });
    gallery.appendChild(captions);

    var thumbs=document.createElement('div');thumbs.className='fzpg-thumbs';thumbs.setAttribute('aria-label','选择预览图片');
    source.groups.forEach(function(group,i){
      var thumb=button('fzpg-thumb'+(i===0?' is-active':''),'查看第 '+(i+1)+' 张图片','');
      var image=group.img.cloneNode(false);image.removeAttribute('title');image.alt='';image.loading='lazy';
      thumb.appendChild(image);thumb.addEventListener('click',function(){show(i,true);});thumbs.appendChild(thumb);
    });
    gallery.appendChild(thumbs);

    var active=0,startX=0,startY=0;
    function revealThumb(selected){
      var left=selected.offsetLeft,right=left+selected.offsetWidth;
      if(left<thumbs.scrollLeft) thumbs.scrollTo({left:left-4,behavior:'smooth'});
      else if(right>thumbs.scrollLeft+thumbs.clientWidth) thumbs.scrollTo({left:right-thumbs.clientWidth+4,behavior:'smooth'});
    }
    function preload(i){
      var original=source.groups[(i+source.groups.length)%source.groups.length].img;
      var image=new Image();image.src=original.currentSrc||original.getAttribute('src')||'';
    }
    function show(i,focusThumb){
      active=(i+source.groups.length)%source.groups.length;
      var original=source.groups[active].img;
      loading.hidden=false;error.hidden=true;main.hidden=false;
      main.onload=function(){loading.hidden=true;};
      main.onerror=function(){loading.hidden=true;main.hidden=true;error.hidden=false;};
      main.src=original.currentSrc||original.getAttribute('src')||'';
      main.alt=original.getAttribute('alt')||original.getAttribute('title')||('内容预览图 '+(active+1));
      if(original.getAttribute('srcset')) main.srcset=original.getAttribute('srcset'); else main.removeAttribute('srcset');
      counter.textContent=(active+1)+' / '+source.groups.length;
      Array.prototype.forEach.call(captions.children,function(el,n){
        var hasText=!!cleanText(source.groups[n].text.join(' '));
        el.hidden=n!==active||!hasText;
      });
      Array.prototype.forEach.call(thumbs.children,function(el,n){
        el.classList.toggle('is-active',n===active);el.setAttribute('aria-current',n===active?'true':'false');
      });
      var selected=thumbs.children[active];revealThumb(selected);
      if(focusThumb) selected.focus({preventScroll:true});
      preload(active+1);
    }
    prev.addEventListener('click',function(){show(active-1,false);});
    next.addEventListener('click',function(){show(active+1,false);});
    gallery.addEventListener('keydown',function(e){
      if(e.key==='ArrowLeft'){e.preventDefault();show(active-1,false);}
      if(e.key==='ArrowRight'){e.preventDefault();show(active+1,false);}
    });
    stage.addEventListener('pointerdown',function(e){startX=e.clientX;startY=e.clientY;});
    stage.addEventListener('pointerup',function(e){
      var dx=e.clientX-startX,dy=e.clientY-startY;
      if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.25) show(active+(dx<0?1:-1),false);
    });
    show(0,false);
    return gallery;
  }

  function init(){
    Array.prototype.forEach.call(document.querySelectorAll(ROOT_SELECTOR),function(root,index){
      if(root.querySelector('.fzpg-gallery')) return;
      var source=findSource(root);if(!source) return;
      var gallery=buildGallery(source,index);
      source.insertBefore.parentNode.insertBefore(gallery,source.insertBefore);
      source.removable.forEach(function(node){if(node.parentNode) node.remove();});
      if(source.container&&!cleanText(source.container.textContent)&&!source.container.children.length) source.container.remove();
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);else init();
})();
