/*
 * DomHouse Energy Horseshoe Card — LitElement
 * Gauge a ferro di cavallo per il fotovoltaico. Replica estetica di flex-horseshoe-card.
 * custom:domhouse-energy-horseshoe
 * v0.4.0 — DomHouse.it
 */

// Drop-in SENZA build (import ESM da CDN). Se bundli con rollup, usa invece: import { LitElement, html, css, svg } from "lit";
import { LitElement, html, css, svg } from "https://cdn.jsdelivr.net/npm/lit@3/+esm";

const n = (v, d) => (v == null || isNaN(Number(v)) ? d : Number(v));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;

// Risolve qualsiasi colore CSS (nome/hex/rgb) in [r,g,b].
const _cvs = document.createElement("canvas").getContext("2d");
const _colorCache = {};
function toRgb(color) {
  if (_colorCache[color]) return _colorCache[color];
  _cvs.fillStyle = "#000";
  _cvs.fillStyle = color;
  const s = _cvs.fillStyle;
  const rgb = s[0] === "#"
    ? [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
    : (s.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
  _colorCache[color] = rgb;
  return rgb;
}
function toHex(color) {
  const [r, g, b] = toRgb(color || "#000000");
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}
function colorAt(value, stops) {
  if (!stops.length) return "var(--primary-color)";
  if (value <= stops[0].stop) return stops[0].color;
  if (value >= stops[stops.length - 1].stop) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (value >= a.stop && value <= b.stop) {
      const t = (value - a.stop) / ((b.stop - a.stop) || 1);
      const ca = toRgb(a.color), cb = toRgb(b.color);
      return `rgb(${Math.round(lerp(ca[0], cb[0], t))}, ${Math.round(lerp(ca[1], cb[1], t))}, ${Math.round(lerp(ca[2], cb[2], t))})`;
    }
  }
  return stops[stops.length - 1].color;
}

/* ============================ CARD ============================ */
class DomHouseEnergyHorseshoe extends LitElement {
  static get properties() {
    return { hass: { attribute: false }, _config: { state: true } };
  }

  setConfig(config) {
    if (!config || !config.entities || !config.entities.length) {
      throw new Error("Devi definire 'entities' (la prima è il ferro di cavallo).");
    }
    const h = config.horseshoe || {};
    const sweep = n(h.sweep, 260); // ampiezza arco (originale: 260°)
    this._geo = {
      sweep,
      rotation: n(h.rotation, 270 - sweep / 2), // gap centrato in basso (260° ≡ rotate -220)
      radius: n(h.radius, 90),
      width: n(h.width, 12),        // spessore arco stato
      scale_width: n(h.scale_width, 6), // spessore traccia
    };
    this._config = {
      name: config.name,
      entities: config.entities.map((e) => (typeof e === "string" ? { entity: e } : { ...e })),
      scale: { min: 0, max: 100, color: "#212121", ...(config.scale || {}) },
      color_stops: config.color_stops || { 0: "var(--primary-color)" },
    };
    this._stops = Object.keys(this._config.color_stops)
      .map((k) => ({ stop: Number(k), color: this._config.color_stops[k] }))
      .sort((a, b) => a.stop - b.stop);
  }

  // Formatta come l'originale: toFixed (punto decimale), niente separatore migliaia.
  _fmt(ent) {
    const st = this.hass && this.hass.states[ent.entity];
    if (!st || ["unavailable", "unknown"].includes(st.state) || st.state === undefined) {
      return { num: null, text: "—", unit: "" };
    }
    const raw = Number(st.state);
    const unit = ent.unit != null ? ent.unit : (st.attributes.unit_of_measurement || "");
    let text;
    if (Number.isFinite(raw)) {
      const d = ent.decimals;
      text = (d == null || isNaN(d)) ? String(Math.round(raw * 100) / 100) : raw.toFixed(d);
    } else {
      text = st.state;
    }
    return { num: Number.isFinite(raw) ? raw : null, text, unit };
  }

  _tap(ent, ev) {
    if (ev) ev.stopPropagation();
    if (!ent || !ent.entity) return;
    const action = (ent.tap_action && ent.tap_action.action) || "more-info";
    if (action === "none") return;
    const e = new Event("hass-more-info", { bubbles: true, composed: true });
    e.detail = { entityId: ent.entity };
    this.dispatchEvent(e);
  }

  // Valore + unità ad apice (come state__value / state__uom dell'originale).
  _stateTpl(fmt, xPct, yPct, fontEm, anchor, ent) {
    return svg`
      <text class="clickable" @click=${(ev) => this._tap(ent, ev)}>
        <tspan class="sv" x="${xPct}%" y="${yPct}%" style="font-size:${fontEm}em; text-anchor:${anchor};">${fmt.text}</tspan>
        ${fmt.unit ? svg`<tspan class="su" dx="-0.1em" dy="-0.45em" style="font-size:${fontEm * 0.6}em;">${fmt.unit}</tspan>` : ""}
      </text>`;
  }

  _rowTpl(ent, yPct) {
    if (!ent || !ent.entity) return "";
    return this._stateTpl(this._fmt(ent), 40, yPct, 1.5, "start", ent);
  }

  _iconFO(ent, yPct) {
    if (!ent || !ent.entity || !ent.icon) return "";
    const w = 1.5 * 12; // 1.5em @ 12px base = 18 unità
    const x = 0.37 * 200 - w;              // right-align a 37%
    const y = (yPct / 100) * 200 - w * 0.85; // centrato verticalmente sulla riga
    return svg`
      <foreignObject x="${x}" y="${y}" width="${w}" height="${w}" class="clickable"
        @click=${(ev) => this._tap(ent, ev)} style="overflow:visible;">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <ha-icon icon="${ent.icon}" style="--mdc-icon-size:${w}px;width:${w}px;height:${w}px;color:var(--primary-text-color);"></ha-icon>
        </div>
      </foreignObject>`;
  }

  render() {
    if (!this._config || !this.hass) return html``;
    const e = this._config.entities;
    const g = this._geo;
    const primary = this._fmt(e[0]);
    const { min, max } = this._config.scale;
    const f = primary.num == null ? 0 : clamp01((primary.num - min) / ((max - min) || 1));
    const col = primary.num == null ? this._config.scale.color : colorAt(primary.num, this._stops);

    const R = g.radius;
    const C = 2 * Math.PI * R;
    const scaleLen = (g.sweep / 360) * C;
    const barLen = f * scaleLen;
    const rot = g.rotation;

    const title = this._config.name != null
      ? this._config.name
      : (((this.hass.states[e[0].entity] || {}).attributes || {}).friendly_name || "");

    return html`
      <ha-card @click=${(ev) => this._tap(e[0], ev)}>
        <div class="wrap">
          <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
            <circle cx="100" cy="100" r=${R} fill="none"
              stroke=${this._config.scale.color} stroke-width=${g.scale_width}
              stroke-linecap="round" stroke-dasharray="${scaleLen} ${C}"
              transform="rotate(${rot} 100 100)"></circle>
            <circle class="bar" cx="100" cy="100" r=${R} fill="none"
              stroke=${col} stroke-width=${g.width}
              stroke-linecap="round" stroke-dasharray="${barLen} ${C * 2}"
              transform="rotate(${rot} 100 100)"></circle>

            <line class="divider" x1="60" y1="84" x2="140" y2="84"></line>

            ${this._stateTpl(primary, 50, 34, 3, "middle", e[0])}

            ${this._iconFO(e[1], 57)}
            ${this._rowTpl(e[1], 57)}

            ${this._iconFO(e[2], 72)}
            ${this._rowTpl(e[2], 72)}

            <text class="nam" x="50%" y="95%" style="font-size:1.5em;">${title}</text>
          </svg>
        </div>
      </ha-card>`;
  }

  getCardSize() { return 4; }

  static getConfigElement() {
    return document.createElement("domhouse-energy-horseshoe-editor");
  }

  static getStubConfig() {
    return {
      name: "Produzione",
      scale: { min: 0, max: 3000, color: "#212121" },
      color_stops: { 0: "#4caf50", 3000: "#4caf50" },
      entities: [
        { entity: "sensor.energia_prodotta_w", unit: "W", decimals: 0 },
        { entity: "sensor.energia_oggi_prodotta", unit: "kWh", decimals: 2, icon: "mdi:solar-power" },
        { entity: "sensor.energia_oggi_immessa", unit: "kWh", decimals: 2, icon: "mdi:transmission-tower-import" },
      ],
    };
  }

  static get styles() {
    return css`
      :host { cursor: pointer; }
      ha-card { padding: 10px 10px 0px 10px; box-sizing: border-box; font-size: 12px; }
      .wrap { position: relative; width: 100%; }
      svg { width: 100%; height: auto; display: block; overflow: visible; }
      .bar { transition: stroke-dasharray 2.5s ease-out, stroke 0.3s; }
      .sv { fill: var(--primary-text-color); }
      .su { fill: var(--primary-text-color); opacity: 0.7; }
      .nam {
        fill: var(--primary-text-color); opacity: 0.8; text-anchor: middle;
        text-transform: uppercase; letter-spacing: 0.1em;
      }
      .divider { stroke: var(--primary-text-color); stroke-width: 5; stroke-linecap: round; opacity: 0.7; }
      .clickable { cursor: pointer; }
    `;
  }
}

/* ============================ EDITOR ============================ */
const LABELS = {
  name: "Nome", entity: "Entità", unit: "Unità di misura", decimals: "Decimali",
  icon: "Icona", tap_action: "Azione al tap",
  sweep: "Ampiezza arco (°)", width: "Spessore arco", scale_width: "Spessore traccia",
  min: "Min scala", max: "Max scala",
};
const TAP_OPTS = [
  { value: "more-info", label: "Apri more-info" },
  { value: "none", label: "Nessuna azione" },
];
const ENT_SCHEMA = (withIcon) => [
  { name: "entity", selector: { entity: {} } },
  { type: "grid", schema: [
    { name: "unit", selector: { text: {} } },
    { name: "decimals", selector: { number: { min: 0, max: 6, mode: "box" } } },
  ] },
  ...(withIcon ? [{ name: "icon", selector: { icon: {} } }] : []),
  { name: "tap_action", selector: { select: { mode: "dropdown", options: TAP_OPTS } } },
];

class DomHouseEnergyHorseshoeEditor extends LitElement {
  static get properties() {
    return { hass: { attribute: false }, _config: { state: true }, _stopsArr: { state: true } };
  }

  setConfig(config) {
    this._config = config || {};
    this._stopsArr = Object.keys(this._config.color_stops || {})
      .map((k) => ({ stop: Number(k), color: this._config.color_stops[k] }))
      .sort((a, b) => a.stop - b.stop);
  }

  _computeLabel = (s) => LABELS[s.name] || s.name;

  _emit(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  _valGeneral = (ev) => {
    const name = ev.detail.value.name;
    this._emit({ ...this._config, name: name ? name : undefined });
  };

  _buildEnt(v, withIcon) {
    const o = {};
    if (v.entity) o.entity = v.entity;
    if (v.unit) o.unit = v.unit;
    if (v.decimals != null) o.decimals = v.decimals;
    if (withIcon && v.icon) o.icon = v.icon;
    if (v.tap_action && v.tap_action !== "more-info") o.tap_action = { action: v.tap_action };
    return o;
  }

  _setEnt(idx, withIcon, ev) {
    const ents = [...(this._config.entities || [])];
    while (ents.length < 3) ents.push({});
    ents[idx] = this._buildEnt(ev.detail.value, withIcon);
    while (ents.length > 1 && !ents[ents.length - 1].entity) ents.pop();
    this._emit({ ...this._config, entities: ents });
  }

  _valGeo = (ev) => {
    const v = ev.detail.value;
    const h = { ...(this._config.horseshoe || {}) };
    if (v.sweep != null) h.sweep = v.sweep; else delete h.sweep;
    if (v.width != null) h.width = v.width; else delete h.width;
    if (v.scale_width != null) h.scale_width = v.scale_width; else delete h.scale_width;
    this._emit({ ...this._config, horseshoe: Object.keys(h).length ? h : undefined });
  };

  _valScale = (ev) => {
    const v = ev.detail.value;
    const scale = { ...(this._config.scale || {}), min: v.min, max: v.max };
    this._emit({ ...this._config, scale });
  };

  _valTrack = (ev) => {
    const scale = { ...(this._config.scale || {}), color: ev.target.value };
    this._emit({ ...this._config, scale });
  };

  _stopChange(i, field, value) {
    const arr = this._stopsArr.map((s) => ({ ...s }));
    arr[i][field] = field === "stop" ? Number(value) : value;
    this._stopsArr = arr;
    this._writeStops();
  }
  _stopAdd = () => {
    const last = this._stopsArr[this._stopsArr.length - 1];
    this._stopsArr = [...this._stopsArr, { stop: last ? last.stop + 1000 : 0, color: "#4caf50" }];
    this._writeStops();
  };
  _stopRemove(i) {
    this._stopsArr = this._stopsArr.filter((_, j) => j !== i);
    this._writeStops();
  }
  _writeStops() {
    const obj = {};
    [...this._stopsArr].sort((a, b) => a.stop - b.stop).forEach((s) => { obj[s.stop] = s.color; });
    this._emit({ ...this._config, color_stops: obj });
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const c = this._config;
    const ents = c.entities || [];
    const e0 = ents[0] || {}, e1 = ents[1] || {}, e2 = ents[2] || {};
    const tap = (e) => (e.tap_action && e.tap_action.action) || "more-info";
    const h = c.horseshoe || {}, sc = c.scale || {};

    return html`
      <div class="editor">
        <ha-form .hass=${this.hass} .data=${{ name: c.name ?? "" }}
          .schema=${[{ name: "name", selector: { text: {} } }]}
          .computeLabel=${this._computeLabel} @value-changed=${this._valGeneral}></ha-form>

        <h4>Ferro di cavallo (entità principale)</h4>
        <ha-form .hass=${this.hass}
          .data=${{ entity: e0.entity, unit: e0.unit, decimals: e0.decimals, tap_action: tap(e0) }}
          .schema=${ENT_SCHEMA(false)} .computeLabel=${this._computeLabel}
          @value-changed=${(ev) => this._setEnt(0, false, ev)}></ha-form>

        <h4>Riga 1</h4>
        <ha-form .hass=${this.hass}
          .data=${{ entity: e1.entity, unit: e1.unit, decimals: e1.decimals, icon: e1.icon, tap_action: tap(e1) }}
          .schema=${ENT_SCHEMA(true)} .computeLabel=${this._computeLabel}
          @value-changed=${(ev) => this._setEnt(1, true, ev)}></ha-form>

        <h4>Riga 2</h4>
        <ha-form .hass=${this.hass}
          .data=${{ entity: e2.entity, unit: e2.unit, decimals: e2.decimals, icon: e2.icon, tap_action: tap(e2) }}
          .schema=${ENT_SCHEMA(true)} .computeLabel=${this._computeLabel}
          @value-changed=${(ev) => this._setEnt(2, true, ev)}></ha-form>

        <h4>Geometria arco</h4>
        <ha-form .hass=${this.hass}
          .data=${{ sweep: h.sweep ?? 260, width: h.width ?? 12, scale_width: h.scale_width ?? 6 }}
          .schema=${[
            { name: "sweep", selector: { number: { min: 180, max: 320, step: 5, mode: "slider" } } },
            { type: "grid", schema: [
              { name: "width", selector: { number: { min: 4, max: 24, step: 1, mode: "slider" } } },
              { name: "scale_width", selector: { number: { min: 2, max: 16, step: 1, mode: "slider" } } },
            ] },
          ]}
          .computeLabel=${this._computeLabel} @value-changed=${this._valGeo}></ha-form>

        <h4>Scala</h4>
        <ha-form .hass=${this.hass} .data=${{ min: sc.min ?? 0, max: sc.max ?? 3000 }}
          .schema=${[{ type: "grid", schema: [
            { name: "min", selector: { number: { mode: "box" } } },
            { name: "max", selector: { number: { mode: "box" } } },
          ] }]}
          .computeLabel=${this._computeLabel} @value-changed=${this._valScale}></ha-form>

        <div class="color-line">
          <label>Colore traccia di fondo</label>
          <input type="color" .value=${toHex(sc.color || "#212121")} @input=${this._valTrack}>
        </div>

        <h4>Color stops <span class="hint">(colore dell'arco in base al valore)</span></h4>
        <div class="stops">
          ${this._stopsArr.map((s, i) => html`
            <div class="stop-row">
              <input class="num" type="number" .value=${String(s.stop)}
                @input=${(e) => this._stopChange(i, "stop", e.target.value)}>
              <input type="color" .value=${toHex(s.color)}
                @input=${(e) => this._stopChange(i, "color", e.target.value)}>
              <button class="icon-btn" title="Rimuovi" @click=${() => this._stopRemove(i)}>
                <ha-icon icon="mdi:delete"></ha-icon>
              </button>
            </div>`)}
          <button class="add-btn" @click=${this._stopAdd}>
            <ha-icon icon="mdi:plus"></ha-icon> Aggiungi stop
          </button>
        </div>
      </div>`;
  }

  static get styles() {
    return css`
      .editor { display: flex; flex-direction: column; gap: 4px; }
      h4 { margin: 14px 0 2px; font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
      .hint { font-weight: 400; font-size: 12px; color: var(--secondary-text-color); }
      ha-form { display: block; }
      .color-line { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
      .color-line label { font-size: 14px; color: var(--primary-text-color); }
      .stops { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
      .stop-row { display: grid; grid-template-columns: 1fr 48px 40px; gap: 8px; align-items: center; }
      input[type="number"] {
        padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color);
        background: var(--card-background-color); color: var(--primary-text-color); font: inherit;
      }
      input[type="color"] {
        width: 48px; height: 36px; padding: 0; border: 1px solid var(--divider-color);
        border-radius: 6px; background: none; cursor: pointer;
      }
      .icon-btn, .add-btn {
        display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
        border: 1px solid var(--divider-color); border-radius: 6px;
        background: var(--card-background-color); color: var(--primary-text-color);
        font: inherit; padding: 6px 8px;
      }
      .icon-btn { justify-content: center; }
      .icon-btn ha-icon { --mdc-icon-size: 20px; color: var(--error-color, #db4437); }
      .add-btn { align-self: flex-start; margin-top: 2px; }
      .add-btn ha-icon { --mdc-icon-size: 20px; }
    `;
  }
}

/* ============================ REGISTRAZIONE ============================ */
window.customCards = window.customCards || [];
window.customCards.push({
  type: "domhouse-energy-horseshoe",
  name: "DomHouse Energy Horseshoe",
  description: "Ferro di cavallo per la produzione fotovoltaica (DomHouse.it).",
  preview: false,
  documentationURL: "https://domhouse.it",
});

customElements.define("domhouse-energy-horseshoe", DomHouseEnergyHorseshoe);
customElements.define("domhouse-energy-horseshoe-editor", DomHouseEnergyHorseshoeEditor);
console.info("%c DOMHOUSE-ENERGY-HORSESHOE %c v0.4.0 ", "background:#2a9d8f;color:#fff;border-radius:3px 0 0 3px", "color:#2a9d8f");
