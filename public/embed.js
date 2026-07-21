// KoraForms Embed Script — lightweight (~2KB)
// Usage:
//   <script src="https://forms.korajs.dev/embed.js"></script>
//   KoraForms.popup('my-form-slug')
//   KoraForms.slideIn('my-form-slug', { position: 'right' })

(function() {
	var BASE = (document.currentScript && document.currentScript.src)
		? new URL(document.currentScript.src).origin
		: 'https://forms.korajs.dev';

	function createOverlay() {
		var overlay = document.createElement('div');
		overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
		overlay.addEventListener('click', function(e) {
			if (e.target === overlay) overlay.remove();
		});
		return overlay;
	}

	function createIframe(slug) {
		var iframe = document.createElement('iframe');
		iframe.src = BASE + '/f/' + encodeURIComponent(slug) + '?embed=1';
		iframe.style.cssText = 'border:none;width:100%;height:100%;';
		iframe.setAttribute('allowfullscreen', '');
		iframe.setAttribute('loading', 'lazy');
		return iframe;
	}

	window.KoraForms = {
		popup: function(slug) {
			var overlay = createOverlay();
			var container = document.createElement('div');
			container.style.cssText = 'width:90%;max-width:640px;height:85vh;max-height:800px;background:#fff;border-radius:16px;overflow:hidden;position:relative;box-shadow:0 25px 50px rgba(0,0,0,0.25);';
			var close = document.createElement('button');
			close.innerHTML = '&times;';
			close.style.cssText = 'position:absolute;top:8px;right:12px;z-index:1;background:rgba(0,0,0,0.06);border:none;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;color:#666;';
			close.addEventListener('click', function() { overlay.remove(); });
			container.appendChild(close);
			container.appendChild(createIframe(slug));
			overlay.appendChild(container);
			document.body.appendChild(overlay);
		},
		slideIn: function(slug, opts) {
			opts = opts || {};
			var position = opts.position || 'right';
			var panel = document.createElement('div');
			var side = position === 'left' ? 'left:0;' : 'right:0;';
			panel.style.cssText = 'position:fixed;top:0;' + side + 'bottom:0;width:420px;max-width:100vw;z-index:99999;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,0.15);transition:transform 0.3s ease;';
			var close = document.createElement('button');
			close.innerHTML = '&times;';
			close.style.cssText = 'position:absolute;top:8px;' + (position === 'left' ? 'right' : 'left') + ':8px;z-index:1;background:rgba(0,0,0,0.06);border:none;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;color:#666;';
			close.addEventListener('click', function() { panel.remove(); });
			panel.appendChild(close);
			panel.appendChild(createIframe(slug));
			document.body.appendChild(panel);
		}
	};
})();
