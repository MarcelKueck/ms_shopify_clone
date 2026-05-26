const n=`/*! PhotoSwipe main CSS by Dmytro Semenov | photoswipe.com */\r
\r
.pswp{\r
  --pswp-bg:#000;\r
  --pswp-placeholder-bg:#222;\r
  \r
\r
  --pswp-root-z-index:100000;\r
  \r
  --pswp-preloader-color:rgba(79, 79, 79, 0.4);\r
  --pswp-preloader-color-secondary:rgba(255, 255, 255, 0.9);\r
  \r
  --pswp-icon-color:#fff;\r
  --pswp-icon-color-secondary:#4f4f4f;\r
  --pswp-icon-stroke-color:#4f4f4f;\r
  --pswp-icon-stroke-width:2px;\r
\r
  --pswp-error-text-color:var(--pswp-icon-color);\r
}\r
\r
.pswp{\r
	position:fixed;\r
	top:0;\r
	left:0;\r
	width:100%;\r
	height:100%;\r
	z-index:var(--pswp-root-z-index);\r
	display:none;\r
	touch-action:none;\r
	outline:0;\r
	opacity:0.003;\r
	contain:layout style size;\r
	-webkit-tap-highlight-color:rgba(0, 0, 0, 0);\r
}\r
.pswp:focus{\r
  outline:0;\r
}\r
\r
.pswp *{\r
  box-sizing:border-box;\r
}\r
\r
.pswp img{\r
  max-width:none;\r
}\r
\r
.pswp--open{\r
	display:block;\r
}\r
\r
.pswp,\r
.pswp__bg{\r
	transform:translateZ(0);\r
	will-change:opacity;\r
}\r
\r
.pswp__bg{\r
  opacity:0.005;\r
	background:var(--pswp-bg);\r
}\r
\r
.pswp,\r
.pswp__scroll-wrap{\r
	overflow:hidden;\r
}\r
\r
.pswp__scroll-wrap,\r
.pswp__bg,\r
.pswp__container,\r
.pswp__item,\r
.pswp__content,\r
.pswp__img,\r
.pswp__zoom-wrap{\r
	position:absolute;\r
	top:0;\r
	left:0;\r
	width:100%;\r
	height:100%;\r
}\r
\r
.pswp__img,\r
.pswp__zoom-wrap{\r
	width:auto;\r
	height:auto;\r
}\r
\r
.pswp--click-to-zoom.pswp--zoom-allowed .pswp__img{\r
	cursor:zoom-in;\r
}\r
\r
.pswp--click-to-zoom.pswp--zoomed-in .pswp__img{\r
	cursor:move;\r
	cursor:grab;\r
}\r
\r
.pswp--click-to-zoom.pswp--zoomed-in .pswp__img:active{\r
  cursor:grabbing;\r
}\r
.pswp--no-mouse-drag.pswp--zoomed-in .pswp__img,\r
.pswp--no-mouse-drag.pswp--zoomed-in .pswp__img:active,\r
.pswp__img{\r
	cursor:zoom-out;\r
}\r
.pswp__container,\r
.pswp__img,\r
.pswp__button,\r
.pswp__counter{\r
	-webkit-user-select:none;\r
	user-select:none;\r
}\r
\r
.pswp__item{\r
	z-index:1;\r
	overflow:hidden;\r
}\r
\r
.pswp__hidden{\r
	display:none !important;\r
}\r
.pswp__content{\r
  pointer-events:none;\r
}\r
.pswp__content > *{\r
  pointer-events:auto;\r
}\r
.pswp__error-msg-container{\r
  display:grid;\r
}\r
.pswp__error-msg{\r
	margin:auto;\r
	font-size:1em;\r
	line-height:1;\r
	color:var(--pswp-error-text-color);\r
}\r
.pswp .pswp__hide-on-close{\r
	opacity:0.005;\r
	will-change:opacity;\r
	transition:opacity var(--pswp-transition-duration) cubic-bezier(0.4, 0, 0.22, 1);\r
	z-index:10;\r
	pointer-events:none;\r
}\r
.pswp--ui-visible .pswp__hide-on-close{\r
	opacity:1;\r
	pointer-events:auto;\r
}\r
.pswp__button{\r
	position:relative;\r
	display:block;\r
	width:50px;\r
	height:60px;\r
	padding:0;\r
	margin:0;\r
	overflow:hidden;\r
	cursor:pointer;\r
	background:none;\r
	border:0;\r
	box-shadow:none;\r
	opacity:0.85;\r
	-webkit-appearance:none;\r
	-webkit-touch-callout:none;\r
}\r
\r
.pswp__button:hover,\r
.pswp__button:active,\r
.pswp__button:focus{\r
  transition:none;\r
  padding:0;\r
  background:none;\r
  border:0;\r
  box-shadow:none;\r
  opacity:1;\r
}\r
\r
.pswp__button:disabled{\r
  opacity:0.3;\r
  cursor:auto;\r
}\r
\r
.pswp__icn{\r
  fill:var(--pswp-icon-color);\r
  color:var(--pswp-icon-color-secondary);\r
  position:absolute;\r
  top:14px;\r
  left:9px;\r
  width:32px;\r
  height:32px;\r
  overflow:hidden;\r
  pointer-events:none;\r
}\r
\r
.pswp__icn-shadow{\r
  stroke:var(--pswp-icon-stroke-color);\r
  stroke-width:var(--pswp-icon-stroke-width);\r
  fill:none;\r
}\r
\r
.pswp__icn:focus{\r
	outline:0;\r
}\r
div.pswp__img--placeholder,\r
.pswp__img--with-bg{\r
	background:var(--pswp-placeholder-bg);\r
}\r
\r
.pswp__top-bar{\r
	position:absolute;\r
	left:0;\r
	top:0;\r
	width:100%;\r
	height:60px;\r
	display:flex;\r
  flex-direction:row;\r
  justify-content:flex-end;\r
	z-index:10;\r
	pointer-events:none !important;\r
}\r
.pswp__top-bar > *{\r
  pointer-events:auto;\r
  will-change:opacity;\r
}\r
.pswp__button--close{\r
  margin-right:6px;\r
}\r
.pswp__button--arrow{\r
  position:absolute;\r
  top:0;\r
  width:75px;\r
  height:100px;\r
  top:50%;\r
  margin-top:-50px;\r
}\r
\r
.pswp__button--arrow:disabled{\r
  display:none;\r
  cursor:default;\r
}\r
\r
.pswp__button--arrow .pswp__icn{\r
  top:50%;\r
  margin-top:-30px;\r
  width:60px;\r
  height:60px;\r
  background:none;\r
  border-radius:0;\r
}\r
\r
.pswp--one-slide .pswp__button--arrow{\r
  display:none;\r
}\r
.pswp--touch .pswp__button--arrow{\r
  visibility:hidden;\r
}\r
.pswp--has_mouse .pswp__button--arrow{\r
  visibility:visible;\r
}\r
\r
.pswp__button--arrow--prev{\r
  right:auto;\r
  left:0px;\r
}\r
\r
.pswp__button--arrow--next{\r
  right:0px;\r
}\r
.pswp__button--arrow--next .pswp__icn{\r
  left:auto;\r
  right:14px;\r
  transform:scale(-1, 1);\r
}\r
.pswp__button--zoom{\r
  display:none;\r
}\r
\r
.pswp--zoom-allowed .pswp__button--zoom{\r
  display:block;\r
}\r
.pswp--zoomed-in .pswp__zoom-icn-bar-v{\r
  display:none;\r
}\r
.pswp__preloader{\r
  position:relative;\r
  overflow:hidden;\r
  width:50px;\r
  height:60px;\r
  margin-right:auto;\r
}\r
\r
.pswp__preloader .pswp__icn{\r
  opacity:0;\r
  transition:opacity 0.2s linear;\r
  animation:pswp-clockwise 600ms linear infinite;\r
}\r
\r
.pswp__preloader--active .pswp__icn{\r
  opacity:0.85;\r
}\r
\r
@keyframes pswp-clockwise{\r
  0%{ transform:rotate(0deg); }\r
  100%{ transform:rotate(360deg); }\r
}\r
.pswp__counter{\r
  height:30px;\r
  margin-top:15px;\r
  margin-inline-start:20px;\r
  font-size:14px;\r
  line-height:30px;\r
  color:var(--pswp-icon-color);\r
  text-shadow:1px 1px 3px var(--pswp-icon-color-secondary);\r
  opacity:0.85;\r
}\r
\r
.pswp--one-slide .pswp__counter{\r
  display:none;\r
}\r
`;export{n as default};
