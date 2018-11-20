
namespace sh {
   export interface CodeModel {
      readonly name: string;
      makeRender(parent: Shell): rn.Code;
      makeExec(parent: Shell, code: rn.Code, test: Exec): [ui2.Elem, ui2.Elem];
      execs(): Iterable<Exec>;
   }
   export interface Exec {
      render(parent: ui2.Elem): ui2.Elem | rn.PopupCell;
      //refresh(code: rn.Code): void;
   }


   export abstract class Shell extends ui2.Elem implements rn.CodeHolder, rn.PopupHolder {
      private code: rn.Code;
      model: CodeModel;
      private execModel: Exec;
      private timeline: ui2.Elem;
      private port: ui2.Elem;
      private popup: rn.Popup;
      isZenMode = false;
      get children() {
         return [this.code, this.timeline, this.port, this.popup].filter(c => c != null);
      }
      get gap() { return 5; }
      get clipOn() { return false; }

      resetExec(): () => void {
         if (!this.execModel)
            return () => { };
         let e = this.execModel;
         this.execModel = null;
         this.timeline = null;
         this.port = null;
         return () => {
            this.execModel = e;
            let [a, b] = this.model.makeExec(this, this.code, e);
            this.timeline = a;
            this.port = b;
         }
      }
      maxPopupHeight() {
         return this.parent.parent.size.y - this.position.y - this.parent.position.y;
      }

      fixed(g: Render2D) {
         let w = 10;
         let y = 0;
         let h = 0;
         if (this.code) {
            this.code.position = w.vec(y);
            let sz = this.code.fixedSz(g);
            w += sz.x + this.gap;
            h = h.max(sz.y);
         }
         if (this.timeline) {
            this.timeline.position = w.vec(y);
            let sz = this.timeline.fixedSz(g);
            w += sz.x + this.gap;
            h = h.max(sz.y);
         }
         if (this.port) {
            this.port.position = w.vec(y);
            let sz = this.port.fixedSz(g);
            w += sz.x + this.gap;
            h = h.max(sz.y);
         }
         w = (w - this.gap).max(0);
         return w.vec(h).max(this.loadRect.max).max(this.execRect.max);
      }
      private get execRect() {
         return (0).vec(5).vrect((10).vec())
      }
      private get loadRect() {
         return (0).vec(20).vrect((10).vec())
      }
      protected isCodeVisible(e : CodeModel) {
         return false;
      }
      protected toggleCodeVisible(e : CodeModel) {
         return false;
      }


      renderLocal(g: Render2D) {
         super.renderLocal(g);
         g.shadow = rn.shadow;
         if (this.model /* && !this.model.execs().isEmpty() */)
            g.fillRect(this.execRect, [5, 0, 0, 5], RGB.red.lerp(RGB.black, .5));
         //if (!this.loaded.isEmpty())
            g.fillRect(this.loadRect, [5, 0, 0, 5], RGB.blue.lerp(RGB.black, .5));
         g.resetShadow();
      }
      setCode(code: CodeModel) {
         this.model = code;
         this.code = code.makeRender(this);
         this.timeline = null;
         this.port = null;
      }
      protected abstract newCode() : CodeModel;
      pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         let model: rn.PopupModel;
         if (this.execRect.contains(v)) {
            let execs = this.model.execs().toArray();
            if (execs.length > 0) {
               model = {
                  rows: execs.mapi(e => {
                     return {
                        cols: (parent: rn.Popup) => {
                           return [e.render(parent)];
                        },
                        doit: () => {
                           let [t, r] = this.model.makeExec(this, this.code, e);
                           this.execModel = e;
                           this.timeline = t;
                           this.port = r;
                           return () => {
                              this.timeline = null;
                              this.port = null;
                              this.execModel = null;
                           }
                        }
                     }
                  }),
                  columnCount: 1,
               }
            }
         }
         if (this.loadRect.contains(v)) {
            let loaded = this.loaded;
            {
               this.resetExec();
               let oldCode = this.code;
               let oldModel = this.model;
               model = {
                  rows: ([
                     {
                        cols: () => {
                           return [new rn.PopupLabel("zen " + (this.isZenMode ? "off" : "on")), null];
                        },                        
                        doit: () => { 
                           this.isZenMode = !this.isZenMode;
                           return () => {
                              this.isZenMode = !this.isZenMode;
                           } },
                     } as rn.PopupRow
                  ]).concati(loaded.mapi(e => {
                     return {
                        cols: (parent: rn.Popup) => {
                           return [new rn.PopupLabel(e.name), new rn.PopupCheck(() => this.isCodeVisible(e))];
                        },
                        doit: () => {
                           this.model = e;
                           this.code = this.model.makeRender(this)
                           return () => {
                              this.model = oldModel;
                              this.code = oldCode;
                           }
                        },
                        refresh: (idx:number, oldIndex:number, v : Vector2D) => {
                           if (idx == 1 && idx != oldIndex)
                              return this.toggleCodeVisible(e);
                           else return false;
                        },
                     } as rn.PopupRow;
                  })).concati([
                     {
                        cols: () => {
                           return [new rn.PopupLabel("new"), null];
                        },
                        doit: () => {
                           this.model = this.newCode();
                           this.code = this.model.makeRender(this)
                           return () => {
                              this.model = oldModel;
                              this.code = oldCode;
                           }
                        },
                     }
                  ]).concati(
                     this.backup.isEmpty() ? [] : [{
                        cols: () => {
                           return [new rn.PopupLabel("backup"), null];
                        },
                        doit: () => { return () => {} },
                        onClose: () => {
                           this.loaded.push(...this.backup);
                           this.backup.clear();
                        }
                     }]
                  ),
                  columnCount: 2,
               }
            }
         }
         if (model) {
            this.popup = new rn.Popup(this, model);
            this.popup.position = (0).vec(this.size.y + 10);
            this.popup.fixedSz(g);
            let add = this.popup.position.negate();
            this.popup.update(v.add(add));
            return (w, isDrag, isEnd) => {
               if (isEnd) {
                  if (this.popup.selectedRow && this.popup.selectedRow.onClose)
                     this.popup.selectedRow.onClose();
                  if (model.onClose)
                     model.onClose(this.popup.selectedRow);
                  this.popup = null;
                  return true;
               }
               return this.popup.update(w.add(add));
            }
         }

         return super.pressStartLocal(g, v);
      }
      readonly loaded: CodeModel[] = [];
      readonly backup: CodeModel[] = [];

      //protected availableCode(): Iterable<CodeModel> { return this.loaded; }



      // options to select exist code.
      // options to create new code.
      // options to add/remove code.
      // enable/disable execution.
      // select test case.





   }




}