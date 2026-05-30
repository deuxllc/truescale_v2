(() => {
  function requestDialog({ title, message, inputValue = null, confirmText = "Готово", danger = false }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "app-dialog-backdrop";
      backdrop.setAttribute("role", "presentation");

      const dialog = document.createElement("section");
      dialog.className = "app-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "appDialogTitle");

      const heading = document.createElement("h2");
      heading.id = "appDialogTitle";
      heading.textContent = title;

      const text = document.createElement("p");
      text.textContent = message;

      const input = inputValue === null ? null : document.createElement("input");
      if (input) {
        input.type = "text";
        input.value = inputValue;
        input.autocomplete = "off";
      }

      const actions = document.createElement("div");
      actions.className = "app-dialog-actions";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "tool-button";
      cancelButton.textContent = "Отмена";

      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = danger ? "tool-button danger" : "primary-action";
      confirmButton.textContent = confirmText;

      actions.append(cancelButton, confirmButton);
      dialog.append(heading, text);
      if (input) dialog.append(input);
      dialog.append(actions);
      backdrop.append(dialog);
      document.body.append(backdrop);

      const cleanup = (value) => {
        backdrop.remove();
        document.removeEventListener("keydown", onKeyDown);
        resolve(value);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") cleanup(null);
        if (event.key === "Enter" && input) cleanup(input.value);
      };

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) cleanup(null);
      });
      cancelButton.addEventListener("click", () => cleanup(null));
      confirmButton.addEventListener("click", () => cleanup(input ? input.value : true));
      document.addEventListener("keydown", onKeyDown);
      window.setTimeout(() => (input || confirmButton).focus(), 0);
    });
  }

  async function confirmAction(message, { title = "Подтвердите действие", confirmText = "Подтвердить", danger = false } = {}) {
    return await requestDialog({ title, message, confirmText, danger }) === true;
  }

  window.PlanScaleDialogs = {
    requestDialog,
    confirmAction,
  };
})();
