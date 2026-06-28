async function loadPublicDealerContact() {
  const nodes = [...document.querySelectorAll("[data-dealer-contact]")];
  if (!nodes.length) return;

  const config = await fetch("/api/config").then((res) => res.json()).catch(() => ({}));
  const contact = config.publicDealer || {};
  const name = contact.name || "AutoSwitch Canada";
  const phone = String(contact.phone || "").trim();
  const address = String(contact.address || "").trim();

  nodes.forEach((root) => {
    const nameEl = root.querySelector("[data-contact-name]");
    const phoneEl = root.querySelector("[data-contact-phone]");
    const addressEl = root.querySelector("[data-contact-address]");
    const fallbackEl = root.querySelector("[data-contact-fallback]");

    if (nameEl) nameEl.textContent = name;
    if (phoneEl) {
      phoneEl.textContent = phone;
      phoneEl.href = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : "";
      phoneEl.hidden = !phone;
    }
    if (addressEl) {
      addressEl.textContent = address;
      addressEl.hidden = !address;
    }
    if (fallbackEl) fallbackEl.hidden = Boolean(phone || address);
  });
}

loadPublicDealerContact();
