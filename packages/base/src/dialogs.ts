﻿import { Config } from "./config";
import { getjQuery, isBS3, isBS5Plus } from "./environment";
import { Fluent, addClass, htmlEncode } from "./html";
import { iconClassName, type IconClassName } from "./icons";
import { localText } from "./localtext";
import { isArrayLike, omitUndefined } from "./system";

/**
 * Options for a message dialog button
 */
export interface DialogButton {
    /** Button text */
    text?: string;
    /** Button hint */
    hint?: string;
    /** Button icon */
    icon?: IconClassName;
    /** Click handler */
    click?: (e: MouseEvent) => void;
    /** CSS class for button */
    cssClass?: string;
    /** HTML encode button text. Default is true. */
    htmlEncode?: boolean;
    /** The code that is returned from message dialog function when this button is clicked.
     *  If this is set, and click event will not be defaultPrevented dialog will close.
     */
    result?: string;
}

export type DialogType = "bsmodal" | "uidialog" | "panel";

/**
 * Options that apply to all dialog types
 */
export interface DialogOptions {
    /** Auto dispose dialog on close, default is true */
    autoDispose?: boolean;
    /** True to auto open dialog */
    autoOpen?: boolean;
    /** Backdrop type, static to make it modal, e.g. can't be closed by clicking outside */
    backdrop?: boolean | "static"
    /** List of buttons to show on the dialog */
    buttons?: DialogButton[];
    /** Vertically center modal */
    centered?: boolean;
    /** Show close button, default is true */
    closeButton?: boolean;
    /** Close dialog on escape key. Default is true for message dialogs. */
    closeOnEscape?: boolean;
    /** CSS class to use for all dialog types. Is added to the top ui-dialog, panel or modal element */
    dialogClass?: string;
    /** Dialog content element, or callback that will populate the content */
    element?: HTMLElement | ArrayLike<HTMLElement> | ((element: HTMLElement) => void);
    /** Enable / disable animation. Default is false for message dialogs, true for other dialogs */
    fade?: boolean;
    /** Sets one of modal-fullscreen{-...-down} classes. Only used for bootstrap modals */
    fullScreen?: boolean | "sm-down" | "md-down" | "lg-down" | "xl-down" | "xxl-down",
    /** Modal option for jQuery UI dialog compatibility only. Not to be confused with Bootstrap modal. */
    modal?: boolean;
    /** Event handler that is called when dialog is opened */
    onOpen?: (e?: Event) => void;
    /** Event handler that is called when dialog is closed */
    onClose?: (result: string, e?: Event) => void;
    /** Prefer Bootstrap modals to jQuery UI dialogs when both are available */
    preferBSModal?: boolean;
    /** Prefer Panel even when Modal / jQuery UI is available */
    preferPanel?: boolean;
    /** Callback to get options specific to the dialog provider type */
    providerOptions?: (type: DialogType, opt: DialogOptions) => any;
    /** Scrollable, sets content of the modal to scrollable, only for Bootstrap */
    scrollable?: boolean;
    /** Size. Default is null for (500px) message dialogs, lg for normal dialogs */
    size?: "sm" | "lg" | "xl";
    /** Dialog title */
    title?: string;
    /** Only used for jQuery UI dialogs for backwards compatibility */
    width?: number;
}

export class Dialog {

    private el: HTMLElement;
    private dialogResult: string;

    constructor(opt?: DialogOptions);
    constructor(opt?: DialogOptions, create = true) {

        if (isArrayLike(opt?.element))
            this.el = opt.element[0];
        else if (typeof opt?.element !== "function")
            this.el = opt?.element;
        this.dialogResult = this.el?.dataset.dialogResult;

        if (!create) {
            return;
        }

        this.el ??= document.createElement("div");
        opt = Object.assign({}, Dialog.defaults, omitUndefined(opt));
        if (typeof opt.element === "function")
            opt.element(this.el);

        if (opt.preferPanel || (!hasBSModal() && !hasUIDialog))
            this.createPanel(opt);
        else if (hasUIDialog() && (!hasBSModal() || !opt.preferBSModal))
            this.createUIDialog(opt);
        else {
            this.createBSModal(opt);
        }

        if (opt.onOpen)
            this.onOpen(opt.onOpen);

        if (opt.onClose)
            this.onClose(opt.onClose);

        if (opt.autoDispose)
            this.onClose(this.dispose.bind(this));

        if (this.el.classList.contains("hidden") &&
            typeof opt.element !== "function")
            this.el.classList.remove("hidden");

        if (opt.title !== void 0) {
            this.title(opt.title);
        }

        if (opt.autoOpen)
            this.open();
    }

    static defaults: DialogOptions = {
        autoDispose: true,
        backdrop: false,
        closeButton: true,
        closeOnEscape: false,
        fade: false,
        fullScreen: "sm-down",
        modal: true,
        preferBSModal: Config.bootstrapDialogs,
        size: "lg"
    }

    static getInstance(el: HTMLElement | ArrayLike<HTMLElement>): Dialog {
        el = getDialogEventTarget(el);
        return new (Dialog as any)({ element: el }, false);
    }

    /** The result code of the button that is clicked. Also attached to the dialog element as data-dialog-result */
    get result(): string {
        return this.el ? this.el.dataset.dialogResult : this.dialogResult;
    }

    /** Closes dialog */
    close(): this;
    /** Closes dialog with the result set to value */
    close(result: string): this;
    close(result?: string): this {
        if (result != void 0 || arguments.length) {
            this.el && (this.el.dataset.dialogResult = result);
            this.dialogResult = result;
        }

        var target = getDialogEventTarget(this.el);
        if (!target)
            return;

        if (target.classList.contains("s-Panel"))
            closePanel(this.el);
        else if (target.classList.contains("ui-dialog-content"))
            getjQuery()?.(this.el).dialog?.("close");
        else if (target.classList.contains("modal")) {
            if (isBS5Plus()) {
                bootstrap?.Modal?.getInstance?.(target)?.hide?.();
            } else {
                let $ = getjQuery();
                if ($?.fn?.modal)
                    $(target).modal?.("close");
            }
        }

        return this;
    }

    onClose(handler: (result?: string, e?: Event) => void, before = false) {
        var target = getDialogEventTarget(this.el);
        if (!target)
            return;
        if (target.classList.contains("s-Panel"))
            Fluent.on(target, before ? "panelbeforeclose" : "panelclose", e => handler(this.result, e));
        else if (target.classList.contains("ui-dialog-content"))
            Fluent.on(target, before ? "dialogbeforeclose" : "dialogclose", e => handler(this.result, e));
        else if (target.classList.contains("modal"))
            Fluent.on(target, before ? "hide.bs.modal" : "hidden.bs.modal", e => handler(this.result, e));
    }

    onOpen(handler: (e?: Event) => void, before = false): this {
        var target = getDialogEventTarget(this.el);
        if (!target)
            return;
        if (target.classList.contains("s-Panel"))
            Fluent.on(target, before ? "panelbeforeopen" : "panelopen", handler);
        else if (target.classList.contains("ui-dialog-content"))
            Fluent.on(target, before ? "dialogbeforeopen" : "dialogopen", handler);
        else if (target.classList.contains("modal"))
            Fluent.on(target, before ? "show.bs.modal" : "shown.bs.modal", handler);
        return this;
    }

    /** Closes dialog */
    open() {
        var target = getDialogEventTarget(this.el);
        if (!target)
            return;
        if (target.classList.contains("s-Panel"))
            openPanel(this.el);
        else if (target.classList.contains("ui-dialog-content"))
            getjQuery()?.(target).dialog("open");
        else if (target.classList.contains("modal")) {
            if (isBS5Plus()) {
                bootstrap?.Modal?.getInstance?.(target)?.show?.();
            } else {
                let $ = getjQuery();
                if ($?.fn?.modal)
                    $(target).modal?.("show");
            }
        }

        return this;
    }

    /** Gets the title text of the dialog */
    title(): string;
    /** Sets the title text of the dialog. */
    title(value: string): this;
    title(value?: string): string | this {
        let title = this.header()?.querySelector(".modal-title, .panel-title-text, .ui-dialog-title");
        if (value === void 0 && !arguments.length)
            return title?.textContent;

        title && (title.textContent = value);
        return this;
    }

    get type(): DialogType {
        var root = getDialogRootElement(this.el);
        if (!root)
            return null;
        if (root.classList.contains("modal"))
            return "bsmodal";
        if (root.classList.contains("ui-dialog"))
            return "uidialog";
        if (root.classList.contains("s-Panel"))
            return "panel";
        return null;
    }

    /** Gets the body element of the dialog */
    body(): HTMLElement {
        var root = getDialogRootElement(this.el);
        return root?.querySelector(".modal-body, .panel-body, .ui-dialog-content");
    }

    /** Gets the footer element of the dialog */
    footer(): HTMLElement {
        var root = getDialogRootElement(this.el);
        return root?.querySelector(".modal-footer, .panel-footer, .ui-dialog-footer");
    }

    /** Gets the header element of the dialog */
    header(): HTMLElement {
        var root = getDialogRootElement(this.el);
        return root?.querySelector(".modal-header, .panel-titlebar, .ui-dialog-titlebar");
    }  

    private onButtonClick(e: MouseEvent, btn: DialogButton) {
        e ??= new Event("click") as MouseEvent;
        btn.click && btn.click(e);
        if (btn.result && !((e as any)?.isDefaultPrevented?.() || e?.defaultPrevented))
            this.close(btn.result);
    }

    private createBSButtons(footer: Fluent, buttons: DialogButton[]) {
        for (let btn of buttons) {
            Fluent(dialogButtonToBS(btn))
                .appendTo(footer)
                .on("click", e => this.onButtonClick(e, btn));
        }
    }

    createBSModal(opt: DialogOptions): void {

        var modal = Fluent("div")
            .addClass("modal")
            .addClass(opt.dialogClass)
            .addClass(opt.fade && "fade")
            .attr("tabindex", "-1")
            .appendTo(document.body);

        let header = Fluent("div")
            .addClass("modal-header")
            .append(Fluent("h5")
                .addClass("modal-title"));

        let bs5 = isBS5Plus();
        if (opt.closeButton) {
            let closeButton = Fluent("button")
                .addClass(bs5 ? "btn-close" : "close")
                .attr("type", "button")
                .data(`${bs5 ? "bs-" : ""}dismiss`, "modal")
                .attr("aria-label", DialogTexts.CloseButton);

            if (bs5) {
                closeButton.append(Fluent("span").attr("aria-hidden", "true").html("&times;"));
            }

            if (isBS3()) {
                closeButton.prependTo(header);
            } else {
                closeButton.appendTo(header);
            }
        }

        this.el.classList.add("modal-body");

        let footer = Fluent("div")
            .addClass("modal-footer");

        Fluent("div")
            .addClass("modal-dialog")
            .addClass(opt.scrollable && "modal-scrollable")
            .addClass(opt.size && "modal-" + opt.size)
            .addClass(opt.fullScreen && "modal-full-screen" + (typeof opt.fullScreen === "string" ? `-${opt.fullScreen}-down` : ""))
            .append(Fluent("div")
                .addClass("modal-content")
                .append(header)
                .append(this.el)
                .append(footer))
            .appendTo(modal);


        if (opt.buttons) {
            this.createBSButtons(footer, opt.buttons);
        }

        let modalOpt = {
            backdrop: opt.backdrop,
            keyboard: opt.closeOnEscape
        };

        if (opt.providerOptions)
            Object.assign(modalOpt, opt.providerOptions("bsmodal", opt));

        if (bs5 && bootstrap.Modal) {
            new bootstrap.Modal(modal.getNode(), modalOpt);
        }
        else {
            getjQuery()?.(modal.getNode())?.modal?.(modalOpt);
        };
    }

    private createPanel(opt: DialogOptions) {

        let titlebar = Fluent("div")
            .addClass("panel-titlebar")
            .append(Fluent("div")
                .addClass("panel-titlebar-text"));

        let panel = Fluent("div")
            .addClass("s-Panel")
            .append(titlebar)
            .append(Fluent(this.el).addClass("panel-body"));

        if (opt.closeButton) {
            Fluent("button")
                .addClass("panel-titlebar-close")
                .on("click", this.close.bind(this))
                .appendTo(titlebar);
        }

        opt.buttons && this.createBSButtons(Fluent("div")
            .addClass("panel-footer")
            .appendTo(panel), opt.buttons);

    }

    createUIDialog(opt: DialogOptions): void {

        let dlgOpt = {
            dialogClass: opt.dialogClass,
            title: opt.title,
            modal: opt.modal,
            width: opt.width
        } as any;

        if (opt.buttons) {
            dlgOpt.buttons = opt.buttons.map(btn => {
                let uiButton = dialogButtonToUI(btn);
                uiButton.click = (e: MouseEvent) => this.onButtonClick(e, btn);
                return uiButton;
            });
        }

        if (opt.providerOptions)
            dlgOpt = Object.assign(dlgOpt, opt.providerOptions("uidialog", opt));

        getjQuery()?.(this.el).dialog(dlgOpt);
    }


    dispose(): void {
        try {
            let target = getDialogEventTarget(this.el);
            if (!target)
                return;

            try {
                if (target.classList.contains("ui-dialog-content")) {
                    getjQuery?.()(target)?.dialog?.('destroy');
                    target.classList.remove("ui-dialog-content");
                    target = target.closest(".ui-dialog");
                }
                else if (target.classList.contains("modal")) {
                    if (!getjQuery() && isBS5Plus()) {
                        if (typeof bootstrap !== "undefined")
                            bootstrap.Modal?.getInstance(target)?.dispose?.();
                    }
                    else {
                        getjQuery()?.(target)?.modal?.(isBS3() ? "destroy" : "dispose");
                    }
                    this.el?.classList.remove("modal-body");
                }
                else
                    this.el?.classList.remove("panel-body");
            }
            finally {
                Fluent(target).remove();
            }
        }
        finally {
            this.el = null;
        }
    }
}

export function hasBSModal() {
    return isBS5Plus() || !!(getjQuery()?.fn?.modal);
}

export function hasUIDialog() {
    return !!(getjQuery()?.ui?.dialog);
}

(function () {
    const $ = getjQuery();

    // if both jQuery UI and bootstrap button exists, prefer jQuery UI button as UI dialog needs them
    if ($ && $.fn?.button?.noConflict && $.ui?.button) {
        $.fn.btn = $.fn.button.noConflict();
    }
})();

function dialogButtonToBS(x: DialogButton): HTMLButtonElement {
    let html = x.htmlEncode == null || x.htmlEncode ? htmlEncode(x.text) : x.text;
    let iconClass = iconClassName(x.icon);
    if (iconClass)
        html = '<i class="' + htmlEncode(iconClass) + '"><i>' + (html ? (" " + html) : "");
    let button = document.createElement("button");
    button.classList.add("btn");
    if (x.cssClass)
        addClass(button, x.cssClass);
    if (x.hint)
        button.setAttribute("title", x.hint);
    button.innerHTML = html;
    return button;
}

function dialogButtonToUI(x: DialogButton): any {
    let html = x.htmlEncode == null || x.htmlEncode ? htmlEncode(x.text) : x.text;
    let iconClass = iconClassName(x.icon);
    if (iconClass)
        html = '<i class="' + htmlEncode(iconClass) + '"></i>' + (html ? (" " + html) : "");
    let button = {
        text: html,
        click: x.click
    } as any;
    if (x.cssClass)
        button.cssClass = x.cssClass;
    return button;
}

export function okDialogButton(opt?: DialogButton): DialogButton {
    return {
        text: opt?.text != void 0 ? opt.text : DialogTexts.OkButton,
        cssClass: opt?.cssClass != void 0 ? opt.cssClass : 'btn-info',
        result: opt?.result != void 0 ? opt.result : 'ok',
        click: opt?.click
    }
}

export function yesDialogButton(opt?: DialogButton): DialogButton {
    return {
        text: opt?.text != void 0 ? opt.text : DialogTexts.YesButton,
        cssClass: opt?.cssClass != void 0 ? opt.cssClass : 'btn-primary',
        result: opt?.result != void 0 ? opt.result : 'yes',
        click: opt?.click
    }
}

export function noDialogButton(opt?: DialogButton): DialogButton {
    return {
        text: opt?.text != void 0 ? opt.text : DialogTexts.NoButton,
        cssClass: opt?.cssClass != void 0 ? opt.cssClass : isBS5Plus() ? 'btn-danger' : 'btn-default',
        result: opt?.result != void 0 ? opt.result : 'no',
        click: opt?.click
    }
}

export function cancelDialogButton(opt?: DialogButton): DialogButton {
    return {
        text: opt?.text != void 0 ? opt.text : DialogTexts.CancelButton,
        cssClass: opt?.cssClass != void 0 ? opt.cssClass : isBS5Plus() ? 'btn-secondary' : 'btn-default',
        result: 'cancel',
        click: opt?.click
    }
}

export namespace DialogTexts {
    export declare const AlertTitle: string;
    export declare const CancelButton: string;
    export declare const CloseButton: string;
    export declare const ConfirmationTitle: string;
    export declare const InformationTitle: string;
    export declare const MaximizeHint: string;
    export declare const NoButton: string;
    export declare const OkButton: string;
    export declare const RestoreHint: string;
    export declare const SuccessTitle: string;
    export declare const WarningTitle: string;
    export declare const YesButton: string;

    const defaultTxt: Record<string, string> = {
        AlertTitle: 'Alert',
        CancelButton: 'Cancel',
        CloseButton: 'Close',
        ConfirmationTitle: 'Confirm',
        InformationTitle: 'Information',
        MaximizeHint: 'Maximize',
        NoButton: 'No',
        OkButton: 'OK',
        RestoreHint: 'Restore',
        SuccessTitle: 'Success',
        WarningTitle: 'Warning',
        YesButton: 'Yes'
    };

    function get(this: string) {
        return htmlEncode(localText("Dialogs." + this, defaultTxt[this]));
    }

    for (let k of Object.keys(defaultTxt)) {
        Object.defineProperty(DialogTexts, k, {
            get: get.bind(k)
        });
    }
}

function closePanel(el: (HTMLElement | ArrayLike<HTMLElement>)) {

    let panel = getDialogRootElement(el);
    if (!panel || panel.classList.contains("hidden"))
        return;

    let event = Fluent.trigger(panel, "panelbeforeclose", { bubbles: true });
    if (event?.defaultPrevented || event?.isDefaultPrevented?.())
        return;
    panel.classList.add("hidden");

    let uniqueName = panel.dataset.paneluniquename;
    if (uniqueName) {
        document.querySelectorAll(`[data-hiddenby="${uniqueName}"]`).forEach(hiddenBy => {
            hiddenBy.removeAttribute("data-hiddenby");
        });
    }

    Fluent.trigger(window, "resize");
    document.querySelectorAll(".require-layout").forEach((rl: HTMLElement) => {
        if (rl.offsetWidth > 0 || rl.offsetHeight > 0)
            Fluent.trigger(rl, "layout");
    });
    Fluent.trigger(panel, "panelclose", { bubbles: true });
}

function openPanel(element: HTMLElement | ArrayLike<HTMLElement>, uniqueName?: string) {

    let panel = getDialogRootElement(element);
    if (!panel)
        return;

    let container = document.querySelector('.panels-container') ?? document.querySelector('section.content') as HTMLElement;
    if (panel.parentElement !== container)
        container.appendChild(panel);

    let event = Fluent.trigger(panel, "panelbeforeopen", { bubbles: true });
    if (event?.defaultPrevented || event?.isDefaultPrevented?.())
        return;

    panel.dataset.paneluniquename = uniqueName || panel.id || new Date().getTime().toString();
    function setHideBy(e: HTMLElement) {
        if (e === panel ||
            e.tagName === "LINK" ||
            e.tagName === "SCRIPT" ||
            e.classList.contains("hidden") ||
            e.dataset.hiddenby ||
            (container && e.parentElement !== container) && (e.offsetWidth <= 0 && e.offsetHeight <= 0))
            return;

        e.dataset.hiddenby = panel.dataset.paneluniquename;
    }

    if (container) {
        let c = container.children;
        const cl = c.length;
        for (let i = 0; i < cl; i++) {
            setHideBy(c[i] as HTMLElement);
        }
    }

    document.querySelectorAll('.ui-dialog, .ui-widget-overlay, .modal.show, .modal.in').forEach(setHideBy);

    panel.classList.remove("hidden");
    delete panel.dataset.hiddenby;
    panel.classList.add("s-Panel");

    Fluent.trigger(panel, "panelopen", { bubbles: true });
}

/** Returns .s-Panel, .modal, .ui-dialog */
function getDialogRootElement(element: HTMLElement | ArrayLike<HTMLElement>): HTMLElement {
    if (isArrayLike(element))
        element = element[0];
    if (!element)
        return null;
    return element.closest(".modal, .s-Panel, .ui-dialog");

}

/** Returns .s-Panel, .modal, .ui-dialog-content */
function getDialogEventTarget(element: HTMLElement | ArrayLike<HTMLElement>): HTMLElement {
    if (isArrayLike(element))
        element = element[0];
    if (!element)
        return null;
    return element.closest(".modal, .s-Panel, .ui-dialog-content") as HTMLElement ??
        element.closest(".ui-dialog")?.querySelector(":scope > .ui-dialog-content");
}


/**
 * Options that apply to all message dialog types
 */
export interface MessageDialogOptions extends DialogOptions {
    /** HTML encode the message, default is true */
    htmlEncode?: boolean;
    /** Wrap the message in a `<pre>` element, so that line endings are preserved, default is true */
    preWrap?: boolean;
}

(function () {
    const $ = getjQuery();

    // if both jQuery UI and bootstrap button exists, prefer jQuery UI button as UI dialog needs them
    if ($ && $.fn?.button?.noConflict && $.ui?.button) {
        $.fn.btn = $.fn.button.noConflict();
    }
})();

function getMessageBodyHtml(message: string, options?: MessageDialogOptions): string {
    let encode = options == null || options.htmlEncode == null || options.htmlEncode;
    if (encode)
        message = htmlEncode(message);

    let preWrap = options == null || (options.preWrap == null && encode) || options.preWrap;
    return '<div class="message"' + (preWrap ? ' style="white-space: pre-wrap">' : '>') + message + '</div>';
}

function createMessageDialog(opt: {
    cssClass: string,
    title: string,
    getButtons: () => DialogButton[],
    native: (msg: string) => string,
    message: string,
    options: MessageDialogOptions
}): Partial<Dialog> {

    if (!hasBSModal() && !hasUIDialog()) {
        var result = opt.native(opt.message);
        opt.options?.onClose(result);
        return {
            result
        }
    }

    let options: MessageDialogOptions = Object.assign({
        autoOpen: true,
        closeOnEscape: true,
        dialogClass: "s-MessageDialog" + (opt.cssClass ? " " + opt.cssClass : ""),
        htmlEncode: true,
        preferBSModal: Config.bootstrapMessages,
        title: opt.title
    } satisfies MessageDialogOptions, opt.options);

    if (options.buttons == void 0) {
        options.buttons = opt.getButtons();
    }

    if (options.providerOptions === void 0) {
        options.providerOptions = (type) => {
            if (type === "uidialog") {
                return {
                    width: '40%',
                    maxWidth: 450,
                    minWidth: 180,
                    resizable: false
                }
            }
        }
    }

    if (options.element === void 0) {
        options.element = el => el.innerHTML = getMessageBodyHtml(opt.message, options);
    }

    return new Dialog(options);
}

/** 
 * Displays an alert dialog 
 * @param message The message to display
 * @param options Additional options. 
 * @see AlertOptions 
 * @example 
 * alertDialog("An error occured!"); }
 */
export function alertDialog(message: string, options?: MessageDialogOptions): Partial<Dialog> {
    return createMessageDialog({
        message,
        options,
        cssClass: "s-AlertDialog",
        title: DialogTexts.AlertTitle,
        getButtons: () => [okDialogButton({ cssClass: 'btn-danger' })],
        native: (msg) => {
            alert(msg);
            return "ok";
        }
    });
}

/** Additional options for confirm dialog */
export interface ConfirmDialogOptions extends MessageDialogOptions {
    /** True to also add a cancel button */
    cancelButton?: boolean;
    /** Event handler for cancel button click */
    onCancel?: () => void;
    /** Event handler for no button click */
    onNo?: () => void;
}

/** 
 * Display a confirmation dialog 
 * @param message The message to display
 * @param onYes Callback for Yes button click 
 * @param options Additional options. 
 * @see ConfirmOptions 
 * @example 
 * confirmDialog("Are you sure you want to delete?", () => { 
 *     // do something when yes is clicked
 * }
 */
export function confirmDialog(message: string, onYes: () => void, options?: ConfirmDialogOptions): Partial<Dialog> {
    return createMessageDialog({
        message,
        options,
        cssClass: "s-ConfirmDialog",
        title: DialogTexts.ConfirmationTitle,
        getButtons: () => {
            let buttons = [yesDialogButton({ click: onYes }), noDialogButton({ click: options?.onNo })];
            if (options?.cancelButton)
                buttons.push(cancelDialogButton({ click: options?.onCancel }));
            return buttons;
        },
        native: (msg) => {
            var result = window.confirm(msg);
            if (result) {
                onYes?.();
                return 'yes';
            }
            else {
                options?.onNo();
                return result === false ? "no" : "";
            }
        }
    });
}

/** 
 * Display an information dialog 
 * @param message The message to display
 * @param onOk Callback for OK button click 
 * @param options Additional options. 
 * @see ConfirmOptions 
 * @example 
 * informationDialog("Operation complete", () => { 
 *     // do something when OK is clicked
 * }
 */
export function informationDialog(message: string, onOk?: () => void, options?: MessageDialogOptions): Partial<Dialog> {
    return createMessageDialog({
        message,
        options,
        cssClass: "s-InformationDialog",
        title: DialogTexts.InformationTitle,
        getButtons: () => [okDialogButton({ click: onOk, cssClass: 'btn-info' })],
        native: (msg) => {
            alert(msg);
            onOk?.();
            return "ok";
        }
    });
}

/** 
 * Display a success dialog 
 * @param message The message to display
 * @param onOk Callback for OK button click 
 * @param options Additional options. 
 * @see MessageDialogOptions 
 * @example 
 * successDialog("Operation complete", () => { 
 *     // do something when OK is clicked
 * }
 */
export function successDialog(message: string, onOk?: () => void, options?: MessageDialogOptions): Partial<Dialog> {
    return createMessageDialog({
        message,
        options,
        cssClass: "s-SuccessDialog",
        title: DialogTexts.SuccessTitle,
        getButtons: () => [okDialogButton({ click: onOk, cssClass: 'btn-success' })],
        native: (msg) => {
            alert(msg);
            onOk?.();
            return "ok";
        }
    });
}

/** 
 * Display a warning dialog 
 * @param message The message to display
 * @param options Additional options. 
 * @see MessageDialogOptions 
 * @example 
 * warningDialog("Something is odd!");
 */
export function warningDialog(message: string, options?: MessageDialogOptions): Partial<Dialog> {
    return createMessageDialog({
        message,
        options,
        cssClass: "s-WarningDialog",
        title: DialogTexts.SuccessTitle,
        getButtons: () => [okDialogButton({ cssClass: 'btn-warning' })],
        native: (msg) => {
            alert(msg);
            return "ok";
        }
    });
}

/** Options for `iframeDialog` **/
export interface IFrameDialogOptions {
    html?: string;
}

/** 
 * Display a dialog that shows an HTML block in an IFRAME, which is usually returned from server callbacks
 * @param options The options
 */
export function iframeDialog(options: IFrameDialogOptions): Partial<Dialog> {

    if (!hasBSModal() && !hasUIDialog()) {
        window.alert(options.html);
        return {
            result: "ok"
        }
    }

    let doc: Document;
    function onOpen(div: HTMLElement) {
        if (div) {
            let iframe = div.appendChild(document.createElement('iframe'));
            iframe.setAttribute("style", "border: none; width: 100%; height: 100%;");
            doc = iframe.contentDocument;
            if (doc) {
                doc.open();
                doc.write(options.html);
                doc.close();
            }
        }
    }

    return new Dialog({
        title: DialogTexts.AlertTitle,
        dialogClass: "s-IFrameDialog",
        size: "lg",
        autoOpen: true,
        element: el => {
            let div = document.createElement("div");
            div.style.overflow = "hidden";
            el.append(div);
            onOpen(div);
        },
        providerOptions: (type) => {
            if (type == "uidialog") {
                return {
                    width: '60%',
                    height: '400'
                }
            }
        }
    });
}