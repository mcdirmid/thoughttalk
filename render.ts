namespace rn {
   export let shadow: Shadow = {
      blur: 3.5,
      offset: (+.5).vec(+1),
      color: RGB.black,
   };
   export let font: Font = Font.make(f => {
      f.family = "HelveticaNeue";
      f.style = "normal";
      f.weight = "normal"
      f.size = 18;
   });
   export let smallFont = font.remake(f => {
      f.size = f.size / 2;
      f.weight = "bold";
   });
   export let fontColor = RGB.grey.lerp(RGB.black, .25);
}

namespace rn {
   // lets do menus right. 

   export interface PopupRow {
      cols(parent: Popup): Iterable<PopupCell | ui2.Elem>;
      doit(): () => void;
      refresh?(colIndex: number, oldColIndex: number, v: Vector2D): boolean;
      onClose?(): void;
   }
   export interface PopupCell {
      render(g: Render2D, at?: Vector2D, sz?: Vector2D): Vector2D;
   }
   export interface PopupModel {
      readonly rows: Iterable<PopupRow>;
      readonly columnCount: number;
      onClose?(row: PopupRow): void;
   }
   export interface PopupHolder extends ui2.Elem {
      maxPopupHeight() : number;
   }


   export class Popup extends ui2.Elem {
      readonly rows: [PopupRow, (PopupCell | ui2.Elem)[], number, number][] = [];
      readonly children0: ui2.Elem[] = [];
      readonly colWidths: number[];

      get children() { return this.children0; }
      constructor(readonly parent: PopupHolder, model: PopupModel) {
         super();
         for (let row of model.rows) {
            let cols = row.cols(this).toArray();
            this.rows.push([row, cols, -1, -1]);
            for (let c of cols)
               if (c instanceof ui2.Elem)
                  this.children.push(c);
         }
         this.colWidths = [];
         while (this.colWidths.length < model.columnCount)
            this.colWidths.push(0);
      }
      get menuGap() { return 5; }
      private major = 0;
      fixed(g: Render2D): Vector2D {
         let maxHeight = this.parent.maxPopupHeight() - this.position.y;
         true.assert();
         for (let j = 0; j < this.colWidths.length; j += 1)
            this.colWidths[j] = this.menuGap;
         let y = this.menuGap;
         let maxY = 0;
         this.major = 0;

         for (let i = 0; i < this.rows.length; i += 1) {
            let row = this.rows[i];
            let height = 0;
            for (let j = 0; j < this.colWidths.length; j += 1) {
               let col = row[1][j];
               let sz: Vector2D;
               if (col instanceof ui2.Elem)
                  sz = col.fixedSz(g);
               else if (col) sz = col.render(g);
               else sz = Vector2D.Zero;
               this.colWidths[j] = this.colWidths[j].max(sz.x + this.menuGap);
               height = height.max(sz.y);
            }
            let ny = y + height + this.menuGap;
            if (ny <= maxHeight) {
               row[2] = y;
               row[3] = this.major;
               y = ny;
            } else {
               this.major += 1;
               row[2] = this.menuGap;
               row[3] = this.major;
               maxY = maxY.max(y);
               y = this.menuGap * 2 + height;
            }
         }
         maxY = maxY.max(y);
         let perMajorWidth = this.colWidths.sum();
         for (let [unused, cols, y, major] of this.rows) {
            let x = (perMajorWidth + this.menuGap) * major;
            for (let j = 0; j < this.colWidths.length; j += 1) {
               let c = cols[j];
               if (c instanceof ui2.Elem)
                  c.position = (x + this.menuGap / 2).vec(y);
               x += this.colWidths[j];
            }
         }
         let totalWidth = perMajorWidth * (this.major + 1) + (this.menuGap * this.major);
         return totalWidth.vec(maxY);
      }
      private rowIndex = -1;
      private colIndex = -1;
      private undo: () => void;
      static readonly highlight = RGB.sandybrown.alpha(.5);
      get clipOn() { return false; }
      protected renderLocal(g: Render2D) {
         let strokeOpt = {
            stroke: rn.fontColor, lineWidth: .5,
         }
         let perMajorWidth = this.colWidths.sum();
         for (let i = 0; i < this.major + 1; i += 1) {
            let x = (perMajorWidth + this.menuGap) * i;
            let rect = x.vec(0).vrect((perMajorWidth).vec(this.size.y));
            g.shadow = rn.shadow;
            let rounding = [i == 0 ? this.menuGap : 0,
                                    i == this.major ? this.menuGap : 0,
                                    i == this.major ? this.menuGap : 0,
                                    i == 0 ? this.menuGap : 0]


            g.fillRect(rect, rounding, RGB.white);
            g.resetShadow();
            g.strokeRect(rect, rounding, strokeOpt);
            for (let j = 0; j < this.colWidths.length - 1; j += 1) {
               x += this.colWidths[j];
               g.strokeLine([x.vec(0), x.vec(this.size.y)], strokeOpt);
            }
         }
         for (let i = 0; i < this.rows.length; i += 1) {
            let [r,cS,y,major] = this.rows[i];
            let x = (perMajorWidth + this.menuGap) * major;
            let isLastY = i == this.rows.length - 1 || this.rows[i + 1][2] < y;
            let ny = (!isLastY ? this.rows[i + 1][2] : this.size.y) - this.menuGap;
            let y0 = y > this.menuGap ? y - this.menuGap / 2 : y - this.menuGap;
            if (i > 0)
               g.strokeLine([(x).vec(y0), (x + perMajorWidth).vec(y0)], strokeOpt);
            if (i == this.rowIndex) {
               let y1 = !isLastY ? ny + this.menuGap / 2 : ny + this.menuGap;
               g.fillRect((x).vec(y0).rect((x + perMajorWidth).vec(y1)), null, Popup.highlight);
            }
            for (let j = 0; j < this.colWidths.length; j += 1) {
               let c = this.rows[i][1][j];
               if (c instanceof ui2.Elem || !c) { }
               else c.render(g, (x + this.menuGap / 2).vec(y), (this.colWidths[j] - this.menuGap).vec(ny - y))
               x += this.colWidths[j];
            }
         }
      }
      private findRow(x : number, y: number) : [number,number] {
         if (y < 0)
            return [-1,-1];
         let perMajorWidth = this.colWidths.sum();
         let major = Math.floor(x / (perMajorWidth + this.menuGap));
         //let rows = this.rows.filter(r => r[3] == major);
         let startIdx = this.rows.findIndex(r => r[3] == major);
         if (startIdx < 0 || y > this.size.y)
            return [-1, -1];
         let useX = x - (major * (perMajorWidth + this.menuGap));
         for (let i = startIdx; true; i += 1) 
            if (i == this.rows.length || this.rows[i][3] != major || y < this.rows[i][2])
               return [i - 1, useX];
      }
      get selectedRow() {
         if (this.rowIndex < 0)
            return null;
         else return this.rows[this.rowIndex][0];
      }


      private findCol(x: number): [number, number] {
         let x0 = 0;
         if (x < 0 || x >= this.size.x)
            return [-1, 0];
         for (let i = 0; i < this.colWidths.length; i += 1) {
            x0 += this.colWidths[i];
            if (x <= x0)
               return [i, x - (x0 - this.colWidths[i])];
         }
         return [-1, 0];
      }
      update(v: Vector2D) {
         let newIndex: number;
         let useX : number;
         if (v.x < 0 || v.x > this.size.x)
            newIndex = -1;
         else {
            [newIndex, useX] = this.findRow(v.x, v.y);
         }
         if (this.rowIndex == newIndex) {
            if (this.rowIndex >= 0 && this.rows[this.rowIndex][0].refresh) {
               let [newColIndex, x0] = this.findCol(useX);
               let oldColIndex = this.colIndex;
               this.colIndex = newColIndex;
               return this.rows[this.rowIndex][0].refresh(newColIndex, oldColIndex, v.addX(-x0));
            }
            return false;
         }
         ((this.undo != null) == (this.rowIndex >= 0)).assert();
         if (this.undo)
            this.undo();
         this.undo = null;
         this.rowIndex = newIndex;
         if (this.rowIndex >= 0) {
            this.undo = this.rows[this.rowIndex][0].doit();
            this.colIndex = -1;
            if (this.rows[this.rowIndex][0].refresh) {
               let [newColIndex, x0] = this.findCol(v.x);
               this.colIndex = newColIndex;
               if (this.colIndex != -1)
                  this.rows[this.rowIndex][0].refresh(this.colIndex, -1, v.addX(-x0));
            }
         }
         return true;
      }

   }
   export class PopupLabel extends Object implements PopupCell {
      get adbg() { return this.label; }
      toString() { return this.adbg; }
      constructor(readonly label: string) { super(); }
      get gap() { return 0; }
      render(g: Render2D, at?: Vector2D, sz?: Vector2D): Vector2D {
         if (at)
            g.fillText(this.label, at.addX(this.gap / 2), { font: rn.font, fill: fontColor });
         return (g.textWidth(this.label, rn.font) + this.gap).vec(g.fontHeight(rn.font));
      }
   }
   export class PopupCheck extends Object implements PopupCell {
      constructor(readonly p: () => boolean) {
         super();
      }
      render(g: Render2D, at?: Vector2D, sz?: Vector2D): Vector2D {
         let h = 8;
         if (at) {
            let useAt = at.add(sz.mult(.5)).minus((h / 2).vec());
            let rect = useAt.vrect(h.vec());
            if (this.p()) {
               g.shadow = shadow;
               g.fillRect(rect, 0, RGB.red.lerp(RGB.black, .5));
               g.resetShadow();
            }
            else g.strokeRect(rect, 0, {
               stroke: fontColor, lineWidth: 1,
            })
         }
         return h.vec();
      }
   }



}

namespace rn {


   export abstract class Pattern extends ui2.Elem {
      childColor(child: Pattern): RGB {
         return null;
      }
      private get color(): RGB {
         let ret: RGB;
         if (this.parent instanceof Pattern) {
            ret = this.parent.childColor(this);
            if (!ret)
               ret = this.parent.color;
         }
         if (!ret)
            ret = fontColor;
         if (this.isDragged)
            ret = ret.lerp(RGB.white, .5);
         return ret;
      }
      get fullColor() { return this.color; }


      get children() { return this.children0; }
      private readonly children0: Pattern[] = [];
      private isDragged = false;

      protected innerPress(g: Render2D, v: Vector2D): ui2.DragT { return null; }

      get root(): RootLike {
         return this.parent instanceof RootLike ? this.parent : this.parent instanceof Pattern ? this.parent.root : null;
      }


      protected pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         let root = this.root;
         let model = root instanceof Root ? root.popup(this) : null;
         if (model) {
            let delta = Vector2D.Zero;
            let p: Pattern = this;
            while (true) {
               delta = delta.add(p.position);
               if (p.parent instanceof Pattern) {
                  p = p.parent; continue;
               } else if (p.parent instanceof Root && p.parent.parent instanceof RootHolder) {
                  delta = delta.add(p.parent.position);
                  let holder = p.parent.parent;
                  holder.popup = new Popup(p.parent.parent, model);
                  holder.popup.position = (0).vec(holder.size.y + g.fontHeight(rn.font) * 2);
                  holder.popup.fixedSz(g);
                  delta = delta.addY(-holder.popup.position.y);
                  this.isDragged = true;
                  return (w, isDrag, isEnd) => {
                     if (isEnd) {
                        let selectedRow = holder.popup.selectedRow;
                        if (selectedRow && selectedRow.onClose)
                           selectedRow.onClose();
                        if (model.onClose)
                           model.onClose(selectedRow);
                        holder.popup = null;
                        this.isDragged = false;
                        return true;
                     }
                     let w0 = w.add(delta);
                     return holder.popup.update(w0);
                  }
               } else break;
            }
         }
         return super.pressStartLocal(g, v);
      }
      get requiresParen(): boolean { return true; }
      get parent(): ui2.Elem { return this.parent0; }
      constructor(private readonly parent0: ui2.Elem) {
         super();
      }
   }


   export abstract class RootHolder extends ui2.Elem implements PopupHolder {
      //dragged: [Root, Pattern];
      popup: Popup;
      get children(): ui2.Elem[] { return this.popup ? [this.popup] : []; }
      get clipOn() { return false; }
      abstract maxPopupHeight() : number;
   }


   const ghostFont = font.remake((f) => {
      f.weight = 900;
   })

   export abstract class RootLike extends ui2.Elem { }

   export abstract class Root extends RootLike {
      underline: number[] = [];
      abstract get parent(): ui2.Elem;
      popup(on: Pattern): PopupModel { return null; }
      get children() { return [this.child0]; }
      childColorRoot(child: Pattern): RGB {
         return fontColor;
      }
      fixed(g: Render2D) {
         this.child0.position = (0).vec(0);
         return this.child0.fixedSz(g).max((g.textWidth("XXXX", ghostFont).vec(g.fontHeight(ghostFont))));
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         this.child0.underline = this.underline;
         if (this.child0.children.length == 0) {
            g.fillRect(this.size.asRect(), 0, RGB.grey.alpha(.5))
            g.fillText("XXXX", (0).vec(0), {
               font: ghostFont, fill: RGB.grey
            })
         }
      }
      readonly child0: Seq;
      constructor(child: ((parent: Root) => Seq)) {
         super();
         this.child0 = child(this);
      }
      abstract get liveNow(): Set<Channel>;

      pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         let model = this.popup(null);
         if (!model || !(this.parent instanceof RootHolder))
            return super.pressStartLocal(g, v);
         let delta = this.position;
         let holder = this.parent;


         holder.popup = new Popup(this.parent, model);
         holder.popup.position = (0).vec(holder.size.y + g.fontHeight(rn.font) * 2);
         holder.popup.fixedSz(g);
         delta = delta.addY(-holder.popup.position.y);
         return (w, isDrag, isEnd) => {
            if (isEnd) {
               let selectedRow = holder.popup.selectedRow;
               if (selectedRow && selectedRow.onClose)
                  selectedRow.onClose();
               if (model.onClose)
                  model.onClose(holder.popup.selectedRow);
               holder.popup = null;
               return true;
            }
            let w0 = w.add(delta);
            return holder.popup.update(w0);
         }

      }
      abstract get channels(): Channel[];
   }

   export abstract class ExecRoot<D> extends RootLike {
      abstract get data(): D[];
      abstract get patterns(): Pattern[];
      abstract get divisions(): number[];
      get clipOn() { return false; }
      abstract renderData(d: D, g: Render2D, renderAt?: Vector2D): Vector2D;
      get children() { return this.patterns; }
      get gap() { return 5; }
      private maxY0: number;
      private nextD(i: number, prevD: number) {
         return i == this.patterns.length - 1 ? this.data.length : prevD + this.divisions[i];
      }
      fixed(g: Render2D) {
         (this.divisions.length == this.patterns.length - 1);
         let x = this.gap;
         let maxY0 = 0;
         let maxY1 = 0;
         let prevD = 0;
         let dxS = [] as number[];
         for (let i = 0; i < this.patterns.length; i += 1) {
            if (i > 0)
               x += this.gap;
            let p = this.patterns[i];
            p.position = (x).vec(0);
            let sz = p.fixedSz(g);
            maxY0 = maxY0.max(sz.y);
            // figure out data size.
            let nextD = this.nextD(i, prevD);
            let dx = 0;
            for (let d = prevD; d < nextD; d += 1) {
               if (d > prevD)
                  dx += this.gap / 2;
               let sz = this.renderData(this.data[d], g);
               dx += sz.x;
               maxY1 = maxY1.max(sz.y);
            }
            dxS.push(dx);
            prevD = nextD;
            x += sz.x.max(dx);
         }
         x += this.gap;
         this.maxY0 = maxY0;
         x = x.max(g.textWidth("X", font));
         maxY0 = maxY0.max(g.fontHeight(font));
         maxY1 = maxY1.max(g.fontHeight(font));

         return x.vec(maxY0 + this.gap + maxY1);
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         let prevD = 0;
         let strokeOpt = {
            stroke: fontColor, lineWidth: .5
         };
         g.shadow = shadow;
         g.fillRect(this.size.asRect(), 5, RGB.white);
         g.resetShadow();
         g.strokeRect(this.size.asRect(), 5, strokeOpt);
         g.strokeLine([(0).vec(this.maxY0 + this.gap / 2), this.size.x.vec(this.maxY0 + this.gap / 2)], strokeOpt);
         for (let i = 0; i < this.patterns.length; i += 1) {
            let x = this.patterns[i].position.x - (i > 0 ? this.gap / 2 : 0);
            if (i > 0) {
               g.strokeLine([x.vec(0), x.vec(this.size.y)], strokeOpt);
               x += this.gap / 2;
            }
            let nextD = this.nextD(i, prevD);
            for (let d = prevD; d < nextD; d += 1) {
               if (d > prevD)
                  x += this.gap / 2;
               if (d >= prevD + 1) // && d < nextD - 1)
                  g.strokeLine([(x - this.gap / 4).vec(this.maxY0 + this.gap / 2), (x - this.gap / 4).vec(this.size.y)], strokeOpt);
               let sz = this.renderData(this.data[d], g, x.vec(this.maxY0 + this.gap));
               x += sz.x;
            }
            prevD = nextD;
         }
      }
   }




   export abstract class Term extends Pattern {
      abstract get value(): string;
      subscript(): string { return ""; }
      get children(): Pattern[] { return []; }
      protected get doDot(): boolean { return false; }
      fixed(g: Render2D) {
         let sz = g.textWidth(this.value).vec(g.fontHeight());
         sz = sz.addX(g.textWidth(this.subscript(), smallFont));
         return sz;
      }
      renderLocal(g: Render2D) {
         g.fillText(this.value, Vector2D.Zero, this.fullColor);
         if (this.subscript().length > 0) {
            let x = g.textWidth(this.value);
            g.fillText(this.subscript(),
               x.vec(this.size.y - g.fontHeight(smallFont)),
               { fill: this.fullColor, font: smallFont });
            if (this.doDot) {
               let x0 = (x + (this.size.x - x) / 2);
               g.fillCircle(x0.vec(this.size.y - g.fontHeight(smallFont) - 2), 1.5, this.fullColor.alpha(.25));
            }
         }
      }

   }


   export abstract class Seq extends Pattern {
      underline: number[] = [];
      renderGap(g: Render2D, posX: number, doRender: boolean): number { return 2; }
      protected get needsParen() {
         return this.parent instanceof Pattern && this.parent.requiresParen;
      }
      childColor(child: Pattern) {
         if (this.parent instanceof Root) {
            let clr = this.parent.childColorRoot(child);
            return clr;
         }
         return super.childColor(child);
      }

      get gapP(): number { return 4; }
      get thick(): number { return this.gapP / 2; }
      fixed(g: Render2D) {
         let gap = this.gapP;
         let posX = this.needsParen ? gap : 0;
         let maxY = 0;
         let isFirst = true;
         for (let c of this.children) {
            if (!isFirst)
               posX += this.renderGap(g, posX, false);
            isFirst = false;
            c.position = c.position.setX(posX);
            let csz = c.fixedSz(g);
            posX += csz.x;
            maxY = maxY.max(csz.y);
         }
         for (let c of this.children)
            c.position = c.position.setY(maxY - c.size.y);
         let sz = posX.vec(maxY);
         if (this.needsParen)
            sz = sz.addX(gap).addY(gap);
         return sz;
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         if (this.needsParen) {
            let count = 2;
            for (let p = this.parent; p instanceof Pattern; p = p.parent)
               if (p.requiresParen)
                  count += 1;

            let gap = this.gapP;
            let thick = this.thick;
            let rect = this.size.addY(-gap).asRect();
            rect = rect.grow(-thick / 2);
            g.shadow = rn.shadow;
            g.fillRect(rect, gap, RGB.white.lerp(RGB.black, count * .0125));
            g.resetShadow();
            let clr = this.fullColor.alpha(1);
            let opts = { stroke: clr, lineWidth: thick };
            g.clip((gap * 1).vec(this.size.y).asRect(), () => g.strokeRect(rect, gap, opts));
            g.clip((this.size.x - gap * 1).vec(0).rect(this.size), () => g.strokeRect(rect, gap, opts));
         }
         for (let i = 1; i < this.children.length; i += 1) {
            let posX = this.children[i - 1].position.x + this.children[i - 1].size.x;
            this.renderGap(g, posX, true);
         }
         for (let u of this.underline) {
            let c = this.children[u];
            let x0 = c.position.x;
            let x1 = x0 + c.size.x;
            let y0 = this.size.y - 1;
            g.strokeLine([x0.vec(y0), x1.vec(y0)], {
               stroke: RGB.black,
               lineWidth: 1,
            })
         }
      }
      get requiresParen() { return true; }
   }
   export abstract class Or extends Seq {
      gap(g: Render2D) { return 2; }
      barWidth(g: Render2D) { return 2; }
      renderGap(g: Render2D, posX: number, doRender: boolean): number {
         let gap = this.gap(g);
         let barW = this.barWidth(g);
         if (doRender)
            g.fillRect((posX + gap).vec(barW).vrect(barW.vec(this.size.y - barW * 2 - (this.needsParen ? this.gapP : 0))), barW / 2, this.fullColor);
         return gap * 2 + barW;
      }
   }
   export abstract class Single extends Pattern { }
   export abstract class Opt extends Single {
      fixed(g: Render2D) {
         if (false) {
            let sz = this.children[0].fixedSz(g);
            let gap = 2;
            this.children[0].position = (0).vec(gap);
            return sz.addY(gap);
         } else {
            this.children[0].position = (0).vec(0);
            return this.children[0].fixedSz(g).addX(g.textWidth("?") + 1);
         }
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         if (false) {
            g.strokeLine([(0).vec(0), this.size.x.vec(0)], { stroke: this.fullColor, lineWidth: .5 });
            g.strokeLine([(0).vec(2), this.size.x.vec(2)], { stroke: this.fullColor, lineWidth: .5 });
         } else {
            g.fillText("?", (this.children[0].size.x + 1).vec(this.size.y - g.fontHeight()), this.fullColor);
         }
      }
   }
   let starFont = rn.font.remake(f => f.size = f.size * 1.5);
   export abstract class Star extends Single {
      fixed(g: Render2D) {
         if (false) {
            let sz = this.children[0].fixedSz(g);
            let gap = 2;
            this.children[0].position = (0).vec(gap);
            return sz.addY(gap);
         } else {
            this.children[0].position = (0).vec(0);
            return this.children[0].fixedSz(g).addX(g.textWidth("*", starFont) + 1);
         }
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         if (false) {
            g.fillRect((0).vec(0).vrect(this.size.x.vec(2)), 0, this.fullColor);
         } else {
            let h = g.fontHeight(font);
            g.fillText("*", (this.children[0].size.x + 1).vec(-h / 4), { font: starFont, fill: this.fullColor });
         }
      }
   }

   export abstract class Ordered extends Single {
      abstract get ascending(): boolean;
      get gapY() { return 3; }
      fixed(g: Render2D): Vector2D {
         this.children[0].position = (0).vec(this.gapY);
         let sz = this.children[0].fixedSz(g);
         return sz.addY(this.gapY);
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         let y = this.gapY;



         let pS = [(0).vec(y), (this.size.x).vec(y)];
         if (!this.ascending)
            pS.push(...[(0).vec(0), (0).vec(y)]);
         else pS.unshift(...[this.size.x.vec(y), this.size.x.vec(0)]);
         g.strokeLine(pS, { stroke: this.fullColor, lineWidth: .75 })
      }

   }


}

namespace rn {
   export interface OpElem {
      readonly left: Root;
      readonly right: Operation;
   }
   export interface CodeHolder extends ui2.Elem {
      readonly isZenMode: boolean;
   }

   export abstract class Code extends RootHolder  {
      // layout two columns vertically. 
      abstract operations(): OpElem[];
      abstract get output(): Root;
      get children() {
         let ret: ui2.Elem[] = super.children;
         if (!this.isZenMode) {
            for (let e of this.operations()) {
               ret.push(e.left);
               ret.push(e.right);
            }
         } else {
            let ops = this.operations();
            ret.push(ops[0].left);
            ret.push(ops[0].right);
            if (ops.length > 1) {
               ret.push(ops.last().left);
            }
         }
         ret.push(this.output);
         return ret;
      }

      get isZenMode() {
         let parent = this.parent as CodeHolder;
         return parent.isZenMode ? true : false;
      }
      private readonly widths: [number, number, number] = [0, 0, 0];
      gap: number = 5;
      channelWidth: number = 5;
      channelRadius: number = 4;
      private readonly lanes = new Map<Channel, number>();
      layoutChannels() {
         let operations = this.operations();
         this.lanes.clear();
         if (operations.length == 0) 
            return;
         let lastUsed = new Map<Channel,number>();
         for (let i = 0; i < operations.length; i += 1) {
            let e = operations[i].right;
            for (let cn of [e.channel]) {
               for (let cn0 = cn; cn0; cn0 = cn0.parent) {
                  lastUsed.set(cn0, i);
                  for (let p of cn0.peers())
                     lastUsed.set(p, i);
               }
            }
            for (let cn of e.outChannels) {
               (lastUsed.get(cn.parent) == i).assert();
               (cn.parent == e.channel).assert();
            }
         }
         let active: Channel[][] = new Array<Channel[]>();
         let current = new Set<Channel>([operations[0].right.channel]);
         for (let i = 0; i < operations.length; i += 1) {
            let e = operations[i].right;
            for (let cn of e.outChannels)
               current.add(cn);
            active.push(current.toArray());
            for (let cn of current.filteri(cn => lastUsed.get(cn) == i).toArray())
               current.delete(cn);
         }
         (active.length == operations.length).assert();
         let schedule = new Map<Channel, number | Channel>();
         for (let i = 0; i < active[0].length; i += 1)
            schedule.set(active[0][i], i);
         for (let i = 0; i < operations.length; i += 1) {
            let e = operations[i].right;
            let activei = new Set(active[i]);
            for (let cn of [e.channel])
               schedule.has(cn).assert();
            if (e.outChannels.length == 1)
               schedule.set(e.outChannels[0], e.channel);
            else if (e.outChannels.length > 1) {
               // schedule around parent.
               let n = Math.ceil(e.outChannels.length / 2);
               let s = schedule.get(e.channel);
               while (!(typeof s == "number"))
                  s = schedule.get(s);
               for (let [cn, s0] of schedule) {
                  if (!activei.has(cn))
                     continue;
                  else if (!(typeof s0 == "number") || s0 < s)
                     continue;
                  else if (s0 == s)
                     schedule.set(cn, s + n);
                  else schedule.set(cn, s0 + e.outChannels.length);
               }
               true.assert();
               s += n;
               for (let i = 0; i < e.outChannels.length; i += 1) {
                  if (i < n)
                     schedule.set(e.outChannels[i], s - n + i);
                  else schedule.set(e.outChannels[i], s + (i - n) + 1);
               }

            }
         }
         for (let [a, b] of schedule) {
            let c = a;
            while (typeof b != "number") {
               c = c.parent;
               b = schedule.get(c);
            }
            this.lanes.set(a, b);
         }
      }
      fixed(g: Render2D) {
         this.layoutChannels();
         let usedSchedule = max(this.lanes.values()) + 1;
         this.widths[2] = usedSchedule * 10 + this.gap;
         this.widths[0] = 0;
         this.widths[1] = 0;
         let y = this.gap;
         let operations = this.operations();
         for (let i = 0; i < operations.length; i += 1) {
            let e = operations[i];
            e.left.position = (this.gap / 2).vec(y);
            e.right.position = e.right.position.setY(y);
            let sz0 = e.left.fixedSz(g);
            let sz1 = e.right.fixedSz(g);
            if (this.isZenMode && i != 0 && i != operations.length - 1)
               y += 0; // sz0.y.max(sz1.y)/4;
            else y += sz0.y.max(sz1.y) + this.gap;
            this.widths[0] = this.widths[0].max(sz0.x);
            this.widths[1] = this.widths[1].max(sz1.x);
         }
         this.widths[0] += this.gap + this.gap / 2;
         this.widths[1] += this.gap;
         for (let e of operations)
            e.right.position = e.right.position.setX(this.widths[0]);
         this.output.position = g.textWidth("→ ", font).vec(y);
         let sz = this.output.fixedSz(g);
         y += sz.y + this.gap / 2;


         return (this.widths[0] + this.widths[1] + this.widths[2]).vec(y);
      }
      private channelX(c: Channel) {
         return this.gap + this.lanes.get(c) * this.channelWidth * 2;
      }
      private channelY(e: Operation, isNew: boolean) {
         return e.position.y + (isNew ? this.channelWidth * 2 : 0) + this.gap;
      }
      hiOp: number = -1;
      hiChannel: Channel[] = null;


      renderLocal(g: Render2D) {
         super.renderLocal(g);
         g.shadow = shadow;
         g.fillRect(this.size.asRect(), 5, RGB.white.lerp(RGB.black, .0125));
         g.resetShadow();
         let useStroke = {
            stroke: rn.fontColor, lineWidth: .5,
         };
         g.strokeRect(this.size.asRect(), 5, useStroke);
         let operations = this.operations();
         if (this.hiOp >= 0 && this.hiOp < operations.length) {
            let i = this.hiOp;
            let y0 = i == 0 ? 0 : operations[i].left.position.y - this.gap / 2;
            let y1 = (i + 1 < operations.length ? operations[i + 1].left.position.y - this.gap / 2 : this.output.position.y);
            g.fillRect((0).vec(y0).rect(this.size.x.vec(y1)), null, RGB.sandybrown.alpha(.25));
         }
         g.strokeLine([
            (this.widths[0] - this.gap / 2).vec(0),
            (this.widths[0] - this.gap / 2).vec(this.output.position.y - this.gap / 2),
         ], useStroke);
         g.strokeLine([
            (this.widths[1] + this.widths[0] - this.gap / 2).vec(0),
            (this.widths[1] + this.widths[0] - this.gap / 2).vec(this.output.position.y - this.gap / 2),
         ], useStroke);
         if (!this.isZenMode)
            for (let e of operations.skip(1))
               g.strokeLine([
                  (0).vec(e.right.position.y - this.gap / 2),
                  (this.size.x).vec(e.right.position.y - this.gap / 2),
               ], useStroke);

         g.strokeLine([
            (0).vec(this.output.position.y - this.gap / 2),
            (this.size.x).vec(this.output.position.y - this.gap / 2),
         ], useStroke);

         g.fillText("→ ", (0).vec(this.output.position.y), { font: font, fill: fontColor });

         if (!this.isZenMode) {
            let x2 = this.widths[0] + this.widths[1] + this.gap / 2
            let lastAt = new Map<Channel, Vector2D>();
            //let dead = new Set<Channel>();
            let live = new Set<Channel>();
            if (operations.length > 0)
               live.add(operations[0].right.channel);
            let self = this;
            function strokeOpt(c: Channel, i: number) {
               let expected: Channel;
               if (!self.hiChannel)
                  expected = null;
               else {
                  expected = self.hiChannel[i];
                  while (expected == null && i > 0) {
                     i -= 1;
                     expected = self.hiChannel[i];
                  }
               }
               return {
                  stroke: c.color, lineWidth: expected && expected.isUnder(c) ? 2 : 1
               }
            }
            function fill(p: Vector2D, c: Channel, big: boolean) {
               if (big)
                  g.shadow = shadow;
               g.fillCircle(p, big ? self.channelRadius : self.channelRadius / 2, c.color);
               if (big)
                  g.resetShadow();
            }
            for (let i = 0; i < operations.length; i += 1) {
               let e = operations[i].right;
               let y = this.channelY(e, true);
               let p = (x2 + this.channelX(e.channel)).vec(y - 10);
               for (let c of e.outChannels) {
                  let x = x2 + this.channelX(c);
                  g.strokeLine([x.vec(y), p], strokeOpt(c, i));
                  fill(x.vec(y), c, true);
                  lastAt.set(c, x.vec(y));
                  live.add(c);
               }
               y = this.channelY(e, false);
               if (e.loopBack != null) {
                  let [a, b, c] = e.loopBack;
                  let x = x2 + this.channelX(a);
                  fill(x.vec(y), a, false);
                  g.strokeLine([x.vec(y), lastAt.get(a)], strokeOpt(a, i));
                  live.delete(a);
                  let c0 = lastAt.get(c);
                  let y1 = b.position.y + 15;
                  let x3 = c0.x + 10;

                  g.strokeLine([
                     x.vec(y),
                     c0.x.vec(y - 10),
                     c0.x.vec(c0.y + 10),
                     x.vec(c0.y),
                     x.vec(y1),
                     (c0.x - 2).vec(y1)], strokeOpt(a, i));


               }
               let exec = e.execChannels;
               while (true) {
                  let len = exec.length;
                  exec = flatten(exec.mapi(c => {
                     for (let d of live)
                        if (d.parent == c && e.outChannels.indexOf(d) < 0)
                           return [d].concati(d.peers()).filteri(c => live.has(c));
                     return [c];
                  })).toArray();
                  if (exec.length == len)
                     break;
               }
               for (let c of exec) {
                  if (!live.has(c)) {
                     (e.loopBack[0] == c).assert();
                     continue;
                  }
                  live.has(c).assert();
                  let x = x2 + this.channelX(c);
                  fill(x.vec(y), c, e.outChannels.isEmpty());
                  if (lastAt.has(c)) {
                     g.strokeLine([x.vec(y), lastAt.get(c)], strokeOpt(c, i - 1))
                  } else {
                     // must be root.
                     //let q = x.vec(this.input.position.y + 15);
                     //g.strokeLine([x.vec(y), q], strokeOpt(c))
                  }
                  lastAt.set(c, x.vec(y));
               }
               for (let c of e.smallChannels) {
                  let x = x2 + this.channelX(c);
                  fill(x.vec(y), c, false);
                  lastAt.has(c).assert();
                  g.strokeLine([x.vec(y), lastAt.get(c)], strokeOpt(c, i - 1))
                  lastAt.set(c, x.vec(y));
               }


               let liveNow = (operations[i].left.liveNow);
               let oldLive: Set<Channel> = null;
               for (let c of live.filteri(a => !liveNow.has(a)).toArray()) {
                  if (!oldLive)
                     oldLive = new Set(live);
                  live.delete(c);
                  if (e.loopBack && e.loopBack[0] == c)
                     continue; // already done.
                  else if (oldLive.somei(e => e.parent == c))
                     continue;

                  let parent = c.parent;
                  if (parent) {
                     while (!liveNow.has(parent))
                        parent = parent.parent;
                     let x1 = x2 + this.channelX(parent);
                     let y1 = y + 10;
                     let q = lastAt.get(c);
                     if (q.x == x1) {
                        continue;
                     }
                     g.strokeLine([q, q.setY(y), x1.vec(y1)], strokeOpt(c, i));
                     fill(x1.vec(y1), parent, false);
                     lastAt.set(parent, x1.vec(y1));
                     lastAt.delete(c);
                  }
               }
            }
         } else {
            let todo = operations.last().left.channels;
            todo = todo.sort((a, b) => b.depth - a.depth);
            let x2 = this.widths[0] + this.widths[1] + this.gap / 2

            let self = this;
            function posFor(c: Channel) {
               let x = x2 + self.channelX(c);
               let y = self.gap * 2 + (self.gap * 2 * c.depth);
               return x.vec(y);
            }
            function fill(p: Vector2D, c: Channel) {
               g.shadow = shadow;
               g.fillCircle(p, self.channelRadius, c.color);
               g.resetShadow();
            }
            for (let cn of todo) {
               if (cn.isLoopShadow())
                  continue;
               fill(posFor(cn), cn);
               if (cn.parent)
                  g.strokeLine([posFor(cn), posFor(cn.parent)], {
                     stroke: cn.color, lineWidth: 1
                  })
            }
         }
      }
   }
   export interface Channel {
      readonly color: RGB;
      readonly parent: Channel;
      peers(): Iterable<Channel>;
      readonly isLoop: boolean;
      readonly depth: number;
      isLoopShadow(): boolean;
      isUnder(other: Channel): boolean;
   }
   export interface UserDefined { }
   export abstract class Operation extends ui2.Elem {
      abstract get name(): string;
      //get userDefined(): UserDefined { return null; }
      //abstract get value(): string;
      abstract get channel(): Channel;
      abstract get execChannels(): Channel[];
      abstract get smallChannels(): Channel[];
      abstract get outChannels(): Channel[];
      abstract get loopBack(): [Channel, Operation, Channel];
      abstract get args(): number[];
      get children(): Pattern[] { return []; }
      abstract get parent(): Code;
      fixed(g: Render2D) {
         // schedule channels.
         let x = 0;
         x += g.textWidth(this.name + (this.args.isEmpty() ? "" : " " + this.args.format()));
         let y = g.fontHeight();
         return x.vec(y);
      }
      get nameColor() { return fontColor; }
      renderLocal(g: Render2D) {
         g.fillText(this.name, (0).vec(0), this.nameColor);
         let x = g.textWidth(this.name);
         g.fillText((this.args.isEmpty() ? "" : " " + this.args.format()), x.vec(0), fontColor);
      }
      pressStartLocal(g: Render2D, v: Vector2D) {
         return super.pressStartLocal(g, v);
      }
   }




   export abstract class Timeline extends ui2.Elem {
      abstract get code(): Code;
      abstract channels(): (Channel[])[];
      get channelWidth() { return 7; }
      get channelRadius() { return 4; }
      private channels0: (Channel[])[];
      private oprs: OpElem[];
      fixed(g: Render2D) {
         this.channels0 = this.channels();
         this.oprs = this.code.operations();
         return (this.channels0.length * this.channelWidth * 2).vec(this.code.output.position.y);
      }
      private selected: [number, number] = null;
      translate(v: Vector2D): [number, number] {
         let x = Math.floor(v.x / (this.channelWidth * 2));
         x = x < 0 || x >= this.channels0.length ? -1 : x;
         let lastY = 0;
         if (x < 0 || v.y < 0 || v.y > this.code.size.y)
            return null;
         for (let j = 1; true; j += 1) {
            if (j == this.oprs.length || v.y <= this.oprs[j].left.position.y) {
               if (!this.channels0[x][j - 1])
                  return null;
               return [x, (j - 1)];
            }
         }
      }
      get clipOn() { return false; }
      protected setSelected0(p: [number, number]) {
         this.selected = p;
      }
      private setSelected(p: [number, number]) {
         if (p && (!this.selected || p[0] != this.selected[0] || p[1] != this.selected[1])) {
            this.setSelected0(p);
            return true;
         }
         return false;
      }
      pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         let p = this.translate(v);
         if (!p)
            return super.pressStartLocal(g, v);
         this.setSelected(p);
         return (v) => {
            return this.setSelected(this.translate(v));
         }
      }

      renderLocal(g: Render2D) {
         super.renderLocal(g);
         let strokeOpt = {
            stroke: fontColor, lineWidth: .5
         }
         g.shadow = shadow;
         g.fillRect(this.size.asRect(), 5, RGB.white);
         g.resetShadow();
         g.strokeRect(this.size.asRect(), 5, strokeOpt);
         for (let j = 1; j < this.oprs.length; j += 1) {
            let y = this.oprs[j].left.position.y - this.code.gap / 2;
            g.strokeLine([(0).vec(y), this.size.x.vec(y)], strokeOpt);
         }
         for (let i = 0; i < this.channels0.length; i += 1) {
            let x = (i * this.channelWidth * 2);
            if (i > 0)
               g.strokeLine([x.vec(0), x.vec(this.size.y)], strokeOpt);
            x += this.channelWidth;
            let col = this.channels0[i];
            (col.length == this.oprs.length).assert();
            g.shadow = shadow;
            for (let j = 0; j < col.length; j += 1) {
               if (col[j] == null)
                  continue;
               let y = this.oprs[j].left.position.y;
               if (this.selected && this.selected[0] == i && this.selected[1] == j) {
                  // i is column, j is row. 
                  let y0 = j == 0 ? 0 : y - this.code.gap / 2;
                  let y1 = j + 1 < col.length ? this.oprs[j + 1].left.position.y - this.code.gap / 2 : this.size.y;
                  let x0 = x - this.channelWidth;
                  let x1 = x + this.channelWidth;
                  g.resetShadow();
                  g.fillRect(x0.vec(y0).rect(x1.vec(y1)), 0, RGB.sandybrown.alpha(.25));
                  g.shadow = shadow;
               }
               if (j + 1 < col.length)
                  y = y + (this.oprs[j + 1].left.position.y - y) / 2;
               else y = y + (this.code.output.position.y - y) / 2;
               g.fillCircle(x.vec(y), this.channelRadius, col[j].color);
            }
            g.resetShadow();
         }
      }

   }
}
namespace rn {
}