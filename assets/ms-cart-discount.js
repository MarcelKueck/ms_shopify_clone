
/*
 * MotionSports Cart Drawer
 * Rabattcode-Verarbeitung für Shopify
 *
 * Funktioniert auch nach AJAX-Aktualisierungen
 * des Warenkorbs durch main.mjs.
 */

(function () {
  if (window.__msCartDiscountReady) return;
  window.__msCartDiscountReady = true;

  document.addEventListener('submit', async function (event) {
    var form = event.target.closest('[data-ms-discount-form]');
    if (!form) return;

    event.preventDefault();

    var input = form.querySelector('[name="discount"]');
    var button = form.querySelector('button[type="submit"]');
    var message = form.querySelector('[data-ms-discount-message]');

    var code = (input.value || '').trim();
    if (!code) return;

    button.disabled = true;
    message.hidden = false;
    message.dataset.state = '';
    message.textContent = 'Rabattcode wird geprüft …';

    try {
      var root = (
        window.Shopify &&
        window.Shopify.routes &&
        window.Shopify.routes.root
      ) || '/';

      var response = await fetch(root + 'cart/update.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          discount: code
        })
      });

      var cart = await response.json();

      if (!response.ok) {
        throw new Error(
          cart.description ||
          cart.message ||
          'Der Rabattcode konnte nicht verarbeitet werden.'
        );
      }

      var discounts = Array.isArray(cart.discount_codes)
        ? cart.discount_codes
        : [];

      var match = discounts.find(function (d) {
        return (d.code || '').toLowerCase() === code.toLowerCase();
      });

      var applied = match && match.applicable !== false;

      var drawer = document.querySelector('cart-modal');

      if (
        drawer &&
        typeof drawer.reloadContent === 'function'
      ) {
        await drawer.reloadContent();
      }

      var nextMessage = document.querySelector(
        'cart-modal [data-ms-discount-message]'
      );

      if (nextMessage) {
        nextMessage.hidden = false;
        nextMessage.dataset.state = applied
          ? 'success'
          : 'error';

        nextMessage.textContent = applied
          ? 'Rabattcode hinterlegt. Die endgültige Ermäßigung wird im Checkout geprüft.'
          : 'Der Rabattcode ist derzeit nicht anwendbar. Bitte Code und Bedingungen prüfen.';
      }

    } catch (error) {
      message.dataset.state = 'error';
      message.textContent =
        error.message ||
        'Rabattcode konnte nicht angewendet werden.';

    } finally {
      button.disabled = false;
    }
  });
})();
