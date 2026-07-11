(function () {
  var STORAGE_KEY = 'instructiva_exit_popup_shown';
  var ARM_DELAY_MS = 6000;
  var armed = false;
  var shown = false;

  function alreadyShownThisSession() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; }
    catch (e) { return false; }
  }
  function markShown() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  function buildPopup() {
    var waIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l5.06-1.35A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>';
    var overlay = document.createElement('div');
    overlay.className = 'exit-popup-overlay';
    overlay.id = 'exitPopupOverlay';
    overlay.innerHTML =
      '<div class="exit-popup" role="dialog" aria-modal="true" aria-labelledby="exitPopupTitle">' +
        '<button class="exit-popup-close" id="exitPopupClose" aria-label="Fechar">&times;</button>' +
        '<div class="form-body" id="exitPopupForm">' +
          '<div class="ep-badge">Atendimento no WhatsApp · grátis</div>' +
          '<h3 id="exitPopupTitle">Não sabe <span>qual curso</span> escolher?</h3>' +
          '<p class="sub">Deixe seu WhatsApp que um especialista da Instructiva te ajuda a escolher o curso certo pra você — sem compromisso.</p>' +
          '<div class="field">' +
            '<input type="text" id="epName" autocomplete="name" placeholder="Seu nome">' +
          '</div>' +
          '<div class="field">' +
            '<input type="tel" id="epPhone" autocomplete="tel" placeholder="Seu WhatsApp com DDD">' +
          '</div>' +
          '<div class="ep-quick">' +
            '<span class="ep-quick-label">Você já é técnico?</span>' +
            '<div class="radio-row" id="epTechRow">' +
              '<label class="radio-opt" data-value="sim"><input type="radio" name="epTech" value="sim">Já sou</label>' +
              '<label class="radio-opt" data-value="nao"><input type="radio" name="epTech" value="nao">Tô começando</label>' +
            '</div>' +
          '</div>' +
          '<p class="error-msg" id="epError"></p>' +
          '<button class="submit-btn" id="epSubmit">' + waIcon + ' Falar com um especialista</button>' +
          '<p class="fine-print">Resposta na hora · sem spam · seus dados protegidos</p>' +
        '</div>' +
        '<div class="success-state" id="exitPopupSuccess">' +
          '<div class="icon">&#10003;</div>' +
          '<h3>Recebemos seu contato!</h3>' +
          '<p>Toque no botão pra falar agora com um especialista da Instructiva no WhatsApp.</p>' +
          '<a class="ep-wa-btn" id="epWaBtn" href="#" target="_blank" rel="noopener">' + waIcon + ' Abrir meu WhatsApp</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function setupPopup(overlay) {
    var closeBtn = overlay.querySelector('#exitPopupClose');
    var techRow = overlay.querySelector('#epTechRow');
    var submitBtn = overlay.querySelector('#epSubmit');
    var errorMsg = overlay.querySelector('#epError');
    var formBody = overlay.querySelector('#exitPopupForm');
    var successState = overlay.querySelector('#exitPopupSuccess');
    var waBtn = overlay.querySelector('#epWaBtn');
    var submitLabel = submitBtn.innerHTML;
    var selectedTech = null;

    function hidePopup() { overlay.classList.remove('show'); }
    closeBtn.addEventListener('click', hidePopup);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) hidePopup(); });

    techRow.querySelectorAll('.radio-opt').forEach(function (opt) {
      opt.addEventListener('click', function () {
        techRow.querySelectorAll('.radio-opt').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        selectedTech = opt.dataset.value;
      });
    });

    function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('show'); }
    function clearError() { errorMsg.classList.remove('show'); }

    submitBtn.addEventListener('click', function () {
      clearError();
      var name = overlay.querySelector('#epName').value.trim();
      var phone = overlay.querySelector('#epPhone').value.trim();
      var digits = phone.replace(/\D+/g, '');

      if (!name) { showError('Escreve seu nome pra gente te chamar direito.'); return; }
      if (digits.length < 10) { showError('Coloca seu WhatsApp com DDD.'); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Enviando...';

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name, email: '', phone: phone,
          isTechnician: selectedTech || 'nao_informado',
          source: 'popup_saida_' + window.location.pathname,
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok === false) { throw new Error(res.error || 'falha'); }
          // prepara o botao de WhatsApp do sucesso com o nome do lead
          var msg = 'Olá! Me chamo ' + name + ' e vim pelo site da Escola Instructiva. Queria uma ajuda pra escolher o curso certo pra mim.';
          waBtn.href = 'https://wa.me/5544998500211?text=' + encodeURIComponent(msg);
          formBody.classList.add('hide');
          successState.classList.add('show');
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitLabel;
          showError('Não deu pra enviar agora. Tenta de novo em instantes.');
        });
    });
  }

  function triggerPopup(overlay) {
    if (shown || alreadyShownThisSession()) return;
    shown = true;
    markShown();
    overlay.classList.add('show');
    // registra que o popup foi exibido (fire-and-forget, pra taxa de conversao)
    try {
      fetch('/api/popup-view', { method: 'POST', keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  // conta a visita uma unica vez por sessao, assim que a pagina carrega,
  // independente do popup aparecer ou nao (mede visitantes reais do site)
  var VISIT_KEY = 'instructiva_visit_counted';
  function countVisitOnce() {
    try {
      if (sessionStorage.getItem(VISIT_KEY) === '1') return;
      sessionStorage.setItem(VISIT_KEY, '1');
    } catch (e) {}
    try {
      fetch('/api/visit', { method: 'POST', keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    countVisitOnce();

    // MODO DE TESTE: acessar a pagina com ?popup=teste na URL forca o popup
    // a aparecer na hora, ignorando o timer e a trava de "uma vez por sessao".
    // Serve pra voce conferir se a versao nova esta no ar de verdade.
    var forceShow = /[?&]popup=teste(\b|&|$)/.test(window.location.search);

    if (!forceShow && alreadyShownThisSession()) return;
    var overlay = buildPopup();
    setupPopup(overlay);

    if (forceShow) {
      overlay.classList.add('show');
      return; // nao arma timer nem exit-intent; e so pra teste
    }

    setTimeout(function () { armed = true; }, ARM_DELAY_MS);

    // tempo na pagina: mostra sozinho depois de 30s (se ja nao apareceu por outro gatilho)
    setTimeout(function () { triggerPopup(overlay); }, 30000);

    // desktop: intencao de sair pelo topo da tela
    document.addEventListener('mouseleave', function (e) {
      if (!armed || e.clientY > 0) return;
      triggerPopup(overlay);
    });

    // mobile / fallback: troca de aba ou minimiza o app
    document.addEventListener('visibilitychange', function () {
      if (!armed) return;
      if (document.visibilityState === 'hidden') {
        triggerPopup(overlay);
      }
    });
  });
})();

/* =======================================================================
   ÁREA DO ALUNO — seletor de plataforma
   Ao clicar em "Área do aluno", abre uma janelinha com as plataformas.
   PARA ADICIONAR/EDITAR UMA PLATAFORMA: mexa só na lista PLATAFORMAS abaixo.
   ======================================================================= */
(function () {
  // >>> LISTA DE PLATAFORMAS (nome que aparece + link de acesso do aluno) <<<
  var PLATAFORMAS = [
    { nome: 'Cademi',  desc: 'Cursos e livros digitais',        url: 'https://instructiva.cademi.com.br/auth/login?redirect=%2Foffice%2Fusuario%2Fperfil%2Fcompras%2F21549397' },
    { nome: 'Hotmart', desc: 'Cursos comprados na Hotmart',     url: 'https://sso.hotmart.com/login' },
    { nome: 'Nutror',  desc: 'Área de alunos Nutror',           url: 'https://my.nutror.com/alunos' }
  ];

  var CSS =
    '.aluno-overlay{position:fixed;inset:0;z-index:210;background:rgba(11,11,11,.82);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .2s ease;}' +
    '.aluno-overlay.show{opacity:1;pointer-events:auto;}' +
    '.aluno-box{background:#FAFAF8;width:100%;max-width:420px;border-radius:6px;position:relative;padding:32px 28px 24px;border-top:4px solid #F97316;transform:translateY(10px) scale(.98);transition:transform .2s ease;box-shadow:0 30px 60px -20px rgba(0,0,0,.5);}' +
    '.aluno-overlay.show .aluno-box{transform:translateY(0) scale(1);}' +
    '.aluno-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;background:transparent;cursor:pointer;font-size:22px;color:#6B6B66;line-height:1;display:flex;align-items:center;justify-content:center;border-radius:6px;}' +
    '.aluno-close:hover{background:rgba(0,0,0,.06);color:#0B0B0B;}' +
    '.aluno-eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#F97316;margin-bottom:6px;}' +
    '.aluno-title{font-family:"Manrope",sans-serif;font-weight:800;font-size:21px;color:#0B0B0B;margin:0 0 4px;letter-spacing:-.01em;}' +
    '.aluno-sub{font-family:"Inter",sans-serif;font-size:13.5px;color:#6B6B66;margin:0 0 20px;}' +
    '.aluno-list{display:flex;flex-direction:column;gap:10px;}' +
    '.aluno-item{display:flex;align-items:center;justify-content:center;width:100%;text-align:center;text-decoration:none;background:#fff;border:1px solid #E6E6E1;border-radius:8px;padding:18px 16px;cursor:pointer;transition:.15s;font-family:"Manrope",sans-serif;font-weight:700;font-size:17px;color:#0B0B0B;letter-spacing:-.01em;}' +
    '.aluno-item:hover{border-color:#F97316;background:#FFF7F1;color:#C24E08;transform:translateY(-1px);}';

  function injectCss() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.className = 'aluno-overlay';
    overlay.id = 'alunoOverlay';

    var itemsHtml = PLATAFORMAS.map(function (p) {
      return '<a class="aluno-item" href="' + p.url + '" target="_blank" rel="noopener">' + p.nome + '</a>';
    }).join('');

    overlay.innerHTML =
      '<div class="aluno-box" role="dialog" aria-modal="true" aria-label="Área do aluno">' +
        '<button class="aluno-close" id="alunoClose" aria-label="Fechar">&times;</button>' +
        '<div class="aluno-eyebrow">Área do aluno</div>' +
        '<h3 class="aluno-title">Escolha sua plataforma</h3>' +
        '<p class="aluno-sub">Entre pela plataforma onde você comprou seu curso.</p>' +
        '<div class="aluno-list">' + itemsHtml + '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function hide() { overlay.classList.remove('show'); }
    overlay.querySelector('#alunoClose').addEventListener('click', hide);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) hide(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });

    return overlay;
  }

  function openModal(overlay) { overlay.classList.add('show'); }

  document.addEventListener('DOMContentLoaded', function () {
    injectCss();
    var overlay = buildModal();

    // intercepta qualquer link "Área do aluno" (topo e rodapé) em todas as paginas
    var anchors = Array.prototype.slice.call(document.querySelectorAll('a'));
    anchors.forEach(function (a) {
      // nao intercepta os links de dentro do proprio menu (senao a Cademi so reabriria o menu)
      if (a.closest('.aluno-overlay')) return;
      var txt = (a.textContent || '').trim().toLowerCase();
      var href = a.getAttribute('href') || '';
      if (txt === 'área do aluno' || href.indexOf('cademi.com.br') !== -1) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openModal(overlay);
        });
      }
    });
  });
})();
