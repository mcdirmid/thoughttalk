namespace pt {
   export interface Pattern {
      makeRender(parent: ui2.Elem, index: number): ptrn.Pattern;

   }
   export interface Seq {
      makeRender(parent: ptrn.Pattern | ptrn.Root, index: number): ptrn.Pattern;
   }
   export interface Root {
      makeRender(parent: ui2.Elem): ptrn.Root;
   }
}
namespace ptrn {



   export interface Pattern extends rn.Pattern {
      readonly index: number;
      readonly model: pt.Pattern;
   }
   export interface RootLike extends rn.RootLike {
      readonly model: pt.Root;
   }

   export class Root extends rn.Root implements RootLike {
      liftFront = 0;
      liftBack = 0;
      isBuild?: () => boolean;
      constructor(readonly parent: ui2.Elem, readonly model: pt.Root) {
         super(self => model.asSeq().makeRender(self as Root, 0) as Seq);
      }
      childColorRoot(child: rn.Pattern): RGB {
         let child0 = child as ptrn.Pattern;
         let i = child0.index;
         let clr = this.model.elements[i][1].color;
         if (i < this.liftFront || i >= this.model.elements.length - this.liftBack)
            clr = clr.lerp(RGB.white, .75);
         return clr;
      }
      get liveNow() { return this.model.liveNow; }

      get channels(): pt.Channel[] {
         return this.liveNow.toArray();
      }
      popup(on: Pattern): rn.PopupModel {
         let idxS: number[] = [];
         for (let on0: ui2.Elem = on; on0 instanceof rn.Pattern; on0 = on0.parent)
            idxS.unshift((on0 as ptrn.Pattern).index);
         (idxS.length == 0 || idxS[0] == 0).assert();
         let isBuild = this.isBuild && this.isBuild();
         if (idxS.length >= 2 && !isBuild && this.parent instanceof Code) {
            //let idx = (this.child0 as Seq).model.children.indexOf(on.model);
            //(idx == idxS[1]).assert();
            return this.parent.popupTopSelect(this, idxS);
         } else if (isBuild || this.model.children.length == 0) {
            if (this.parent instanceof Code)
               return this.parent.popupBuild(this, idxS);
         }
         return super.popup(on);
      }
   }
   function init(self: Pattern) {
      (self.children.length == 0).assert();
      for (let i = 0; i < self.model.children.length; i += 1)
         self.children.push(self.model.children[i].makeRender(self, i));
   }


   export class Term extends rn.Term implements Pattern {
      get value() { return this.model.value; }
      constructor(parent: ui2.Elem, readonly index: number, readonly model: pt.Term) {
         super(parent);
         init(this);
      }
   }
   export class Seq extends rn.Seq implements Pattern {
      constructor(parent: Pattern | Root, readonly index: number, readonly model: pt.Seq) {
         super(parent);
         init(this);
      }
   }


   export class Or extends rn.Or implements Pattern {
      constructor(parent: ui2.Elem, readonly index: number, readonly model: pt.Or) {
         super(parent);
         init(this);
      }
   }
   export class Opt extends rn.Opt implements Pattern {
      constructor(parent: ui2.Elem, readonly index: number, readonly model: pt.Opt) {
         super(parent);
         init(this);
      }
   }
   export class Star extends rn.Star implements Pattern {
      constructor(parent: ui2.Elem, readonly index: number, readonly model: pt.Star) {
         super(parent);
         init(this);
      }
   }
}
namespace pt {
   Seq.prototype.makeRender = function (parent, index) {
      return new ptrn.Seq(parent, index, this);
   }
   Or.prototype.makeRender = function (parent, index) {
      return new ptrn.Or(parent, index, this);
   }
   Opt.prototype.makeRender = function (parent, index) {
      return new ptrn.Opt(parent, index, this);
   }
   Star.prototype.makeRender = function (parent, index) {
      return new ptrn.Star(parent, index, this);
   }
   Term.prototype.makeRender = function (parent, index) {
      return new ptrn.Term(parent, index, this);
   }
   Root.prototype.makeRender = function (parent) {
      return new ptrn.Root(parent, this);
   }
   export interface Channel extends rn.PopupCell, rn.Channel { }

   Channel.prototype.render = function (g, at, sz) {
      let self = this as Channel;
      if (at) {
         at = at.add(sz.mult(.5));
         g.shadow = rn.shadow;
         g.fillCircle(at, 4, self.color);
         g.resetShadow();
      }
      return (g.fontHeight(rn.font)).vec();

   }
   Channel.prototype.isLoopShadow = function () {
      let self = this as Channel;
      return self instanceof LoopShadow;
   }
}
namespace en {
   export interface Operation {
      makeOpRender(code: ptrn.Code): ptrn.Operation;
   }
}
namespace ptrn {
   interface OpElem extends rn.OpElem {
      left: Root;
      right: Operation;
      liftFront: number;
      liftBack: number;
   }

   export class Code extends rn.Code {
      private output0: Root;
      private isBuildOutput = false;
      private isBuildInput = false;
      get output() {
         if (!this.output0 || !this.output0.model.asSeq().equals(this.model.output))
            this.output0 = new Root(this, pt.Root.make(this.model.output));
         this.output0.isBuild = () => this.isBuildOutput;
         return this.output0;
      }
      operations() {
         while (this.oprs.length > this.model.operations.length)
            this.oprs.pop();
         while (this.oprs.length < this.model.operations.length)
            this.oprs.push({
               left: null,
               right: null,
               liftFront: 0,
               liftBack: 0,
            });
         // add for extract.
         let roots = this.model.operations.mapi(o => o[1]).toArray();
         let loops = new Map<pt.LoopChannel, number>();
         let lifts: [number, number, "front" | "back", [pt.Pattern, pt.Channel]][] = [];
         for (let i = 0; i < this.model.operations.length; i += 1) {
            let op = this.model.operations[i][0];
            this.oprs[i].liftFront = 0;
            this.oprs[i].liftBack = 0;
            if (op instanceof en.Loop)
               loops.set(op.toLoop, i);
            else if (op instanceof en.Unloop) {
               (op.unify != null).assert();
               let j = loops.get(op.loop);
               for (let k = j; k < i; k += 1) {
                  if (k > j) {
                     let oprs = this.model.operations;
                     roots[k] = oprs[k][0].transform(roots[k - 1], oprs.slice(0, k), false);
                     if (roots[k] == null) {
                        oprs[k][0].transform(roots[k - 1], oprs.slice(0, k), false);
                     }
                  }
                  else roots[j] = roots[j].replace(op.unify);
                  (roots[k] != null).assert();

               }
            } else if (op instanceof en.Lift) {
               let j = loops.get(op.loop);
               (j >= 0 && j < i).assert();
               let element = op.dir == "front" ? roots[i].elements[0] : roots[i].elements.last();
               if (op.dir == "back")
                  lifts.push([i, j, op.dir, element]);
               else lifts.unshift([i, j, op.dir, element]);
            }
         }
         true.assert();
         for (let i = 0; i < this.model.operations.length; i += 1) {
            let lifts0 = lifts.filter(n => i >= n[1] && i < n[0]);
            if (lifts0.length > 0)
               true.assert();
            let front = new pt.Root(...lifts0.filter(n => n[2] == "front").map(n => n[3]));
            let back = new pt.Root(...lifts0.filter(n => n[2] == "back").map(n => n[3]));
            this.oprs[i].liftFront = front.elements.length;
            this.oprs[i].liftBack = back.elements.length;
            roots[i] = roots[i].splice(0, 0, front);
            roots[i] = roots[i].splice(roots[i].elements.length, 0, back);
         }

         for (let i = 0; i < this.model.operations.length; i += 1) {
            let op = this.model.operations[i][0];
            let rt = roots[i];
            if (this.oprs[i].left == null || !this.oprs[i].left.model.equals(rt))
               this.oprs[i].left = new Root(this, rt);
            if (this.oprs[i].right == null || this.oprs[i].right.model != op)
               this.oprs[i].right = op.makeOpRender(this);
            this.oprs[i].left.liftFront = this.oprs[i].liftFront;
            this.oprs[i].left.liftBack = this.oprs[i].liftBack;
            if (i > 0) {
               let prev = this.oprs[i - 1].left;
               let useRoot = this.model.operations[i - 1][1];
               prev.underline = op.underline(useRoot).map(k => k + (i == 0 ? 0 : this.oprs[i - 1].liftFront));
            }
         }
         if (this.oprs.length > 0) {
            (this.oprs[0].right.model == this.model).assert();
            (this.oprs[0].left.model.asSeq().equals(this.model.input)).assert();
            this.oprs[0].left.isBuild = () => this.isBuildInput;
         }
         this.oprs.last().left.underline = [];
         return this.oprs;
      }
      maxPopupHeight() {
         return this.parent.parent.size.y - this.position.y - this.parent.position.y;
      }

      private readonly oprs: OpElem[] = [];
      get userOptions() {
         let p = this.parent;
         while (!(p instanceof Shell)) {
            if (!p)
               return null;
            p = p.parent;
         }
         return p.userOptions;

      }



      constructor(readonly parent: ui2.Elem, readonly model: en.Code) {
         super();
      }
      popupBuild(root: Root, idxS: number[]): rn.PopupModel {
         let options: pt.Seq[] = [];
         (root.parent == this).assert();
         let isOutput: boolean;
         if (root == this.output)
            isOutput = true;
         else if (this.oprs.length > 0 && this.oprs[0].left == root)
            isOutput = false;
         else return null;
         if (isOutput)
            this.isBuildOutput = true;
         else this.isBuildInput = true;


         let update = (root: pt.Seq) => {
            if (isOutput)
               this.model.output = root;
            else this.model.input = root;
         }
         let exist = root.model.asSeq();
         options.push(...root.model.buildOptions(idxS));
         let rows = options.map(seq => {
            let row: rn.PopupRow = {
               cols: (parent) => [pt.Root.make(...seq.children).makeRender(parent)],
               doit: () => {
                  update(seq);
                  return () => update(exist);
               }
            }
            return row;
         })
         if (exist.children.length > 0) {
            let row: rn.PopupRow = {
               cols: () => [new rn.PopupLabel("done")],
               doit: () => {
                  return () => { }
               },
               onClose: () => {
                  if (isOutput)
                     this.isBuildOutput = false;
                  else this.isBuildInput = false;
               }
            }
            rows = rows.concat(row);
         }
         let ret: rn.PopupModel = {
            rows: rows,
            columnCount: 1,
            onClose: () => {
               this.model.execs0 = null;
            }
         }
         return ret;
      }
      popupTopSelect(root: Root, idxS: number[]): rn.PopupModel {
         (idxS.length >= 2).assert();
         let rows: rn.PopupRow[] = [];
         let operations = this.operations();
         if (!operations.isEmpty() && operations.last().left != root)
            return null;
         {
            let prevs = operations.map(e => {
               let root = e.left.model.slice(e.liftFront, e.left.model.elements.length - e.liftBack);
               return [e.right.model, root] as [en.Operation, pt.Root];
            });
            let options = root.model.options(idxS[1], this.userOptions, prevs);
            {
               let p = root.model.access(idxS);
               options.push(...p.options(idxS, root.model, prevs));
            }
            for (let a of options) {
               let transformed = a.transform(root.model, prevs, false);
               if (transformed == null || !transformed.isValid()) {
                  transformed = a.transform(root.model, prevs, false);
               }
               (transformed != null && transformed.isValid()).assert();
               rows.push({
                  cols: (parent: ui2.Elem) => {
                     return [transformed.makeRender(parent as rn.RootHolder),
                     a.makeOpRender(parent as Code), a.channel]
                  },
                  doit: () => {
                     let transformed = a.transform(root.model, prevs, true);
                     this.model.operations.push([a, transformed]);
                     return () => {
                        this.model.operations.pop();
                        a.reset();
                     }
                  },
                  onClose: () => {
                     a.commit(this.model);
                  }
               })
            }
         }
         if (operations.length > 1) {
            rows.push({
               cols: (parent) => {
                  return [
                     operations.last(1).left.model.makeRender(parent),
                     new rn.PopupLabel("undo"), null]
               },
               doit: () => {
                  let pop = this.model.operations.pop();
                  let root = operations[this.model.operations.length - 1].left;
                  let prev = root.underline;
                  root.underline = [];
                  return () => {
                     this.model.operations.push(pop);
                     root.underline = prev;
                  };
               }

            })
            true.assert();
         }
         if (rows.isEmpty()) {
            rows.push({
               cols: (parent: ui2.Elem) => {
                  return [null, new rn.PopupLabel("none"), null];
               },
               doit: () => { return () => { } },
            })
         }
         let onClose0 = this.parent instanceof Shell ? this.parent.resetExec() : null;
         return {
            rows: rows,
            columnCount: 3,
            onClose: (row) => {
               if (onClose0)
                  onClose0();
            },
         }
      }
   }
   export class Operation extends rn.Operation {
      get name() { return this.model.name; }
      get channel() { return this.model.channel; }
      get outChannels() { return this.model.outChannels; }
      get execChannels() { return this.model.execChannels; }
      get smallChannels() { return this.model.smallChannels; }
      get loopBack(): [rn.Channel, rn.Operation, rn.Channel] {
         let ret = this.model.loopBack(this.parent.model);
         if (!ret)
            return null;
         let e = this.parent.operations().find(a => a.right.model == ret[1]);
         return [ret[0], e.right, ret[2]];
      }
      get args() { return this.model.args; }
      get model() { return this.model0; }
      constructor(readonly parent: Code, private readonly model0: en.Operation) {
         super();
      }
   }
   export class UserDefined extends Operation {
      get nameColor() { return RGB.dodgerblue; }
   }
   export class CodeOp extends Operation {
      get model() { return super.model as en.Code; }
      get nameColor() { return this.model.name.length > 0 ? RGB.dodgerblue : RGB.grey; }
      get name() { return this.model.name.length > 0 ? this.model.name : "enter name"; }
      caret = 0;
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         if (this.isSelected && this.parent.operations().length == 1) {
            let x = g.textWidth(this.model.name.substr(0, this.caret), rn.font);
            g.strokeLine([x.vec(0), x.vec(this.size.y)], {
               stroke: RGB.red, lineWidth: 2,
            })
         } else {
            // underline.
            let y = this.size.y - 2;
            g.strokeLine([(0).vec(y), this.size.x.vec(y)], {
               stroke: RGB.dodgerblue, lineWidth: 2
            })
         }
      }
      doKey(key: KeyboardEvent, g: Render2D) {
         this.caret = this.caret.clamp(0, this.model.name.length);
         let nm = this.model.name;
         switch (key.code) {
            case "ArrowRight":
               this.caret = (this.caret + 1).min(nm.length);
               return true;
            case "ArrowLeft":
               this.caret = (this.caret - 1).max(0);
               return true;
            case "Backspace":
               if (this.caret > 0) {
                  this.caret -= 1;
                  let newName = nm.slice(0, this.caret) + nm.slice(this.caret + 1);
                  this.model.name = newName;
                  this.invalidate();
                  return true;
               }
         }
         if (key.key && key.key.length == 1) {
            let newName = nm.slice(0, this.caret) + key.key + nm.slice(this.caret);
            this.caret += 1;
            if (this.model.name.length == 0 && (this.parent.parent as Shell).loaded.indexOf(this.model) < 0)
               (this.parent.parent as Shell).loaded.push(this.model);

            this.model.name = newName;
            this.invalidate();
            return true;
         }
         return super.doKey(key, g)
      }

   }

}
namespace en {
   Operation.prototype.makeOpRender = function (code) {
      let self = this as Operation;
      return new ptrn.Operation(code, self);
   }
   Call.prototype.makeOpRender = function (code) {
      let self = this as Call;
      return new ptrn.UserDefined(code, self);
   }
   Code.prototype.makeOpRender = function (code) {
      let self = this as Code;
      return new ptrn.CodeOp(code, self);

   }
}

namespace ptrn {
   export class ExecRoot extends rn.ExecRoot<any> implements RootLike {
      readonly patterns: Pattern[] = [];
      divisions: number[] = [];
      get data() { return this.context.data.slice(this.context.start, this.context.end); }
      private context: ex.Context;
      get model() {
         let eS = this.patterns.map(p => [p.model, pt.RootChannel] as [pt.Pattern, pt.Channel]);
         return new pt.Root(...eS);
      }

      set(txt: ex.Context) {
         this.context = txt;
         let j = 0;
         for (let i = 0; i < txt.exemes.length; i += 1) {
            if (j < this.patterns.length && this.patterns[j].model.equals(txt.exemes[j].pattern)) {
               j += 1;
               continue;
            }
            let nextP = txt.exemes[i].pattern.makeRender(this, i);
            if (j < this.patterns.length) {
               this.patterns.splice(j, 1, nextP);
               j += 1;
            }
            else {
               (j == this.patterns.length).assert();
               this.patterns.push(nextP);
               j += 1;
            }
         }
         while (this.patterns.length > txt.exemes.length)
            this.patterns.pop();
         this.divisions = txt.exemes.map(e => e.length);
         (this.divisions.sum() == txt.end - txt.start).assert();
         this.divisions.pop();
      }
      constructor(readonly parent: ui2.Elem, txt: ex.Context) {
         super();
         this.set(txt);
      }
      renderData(d: any, g: Render2D, at?: Vector2D) {
         let sz = g.textWidth("" + d, rn.font).vec(g.fontHeight(rn.font));
         if (at)
            g.fillText("" + d, at, { font: rn.font, fill: rn.fontColor });
         return sz;
      }
   }


   export class Timeline extends rn.Timeline {
      private operations: ex.Context[][];
      private first: ex.Context;
      constructor(readonly parent: ui2.Elem, readonly code: Code, readonly exec: ExecRoot, txt: ex.Context, rev: boolean) {
         super();
         this.refresh(txt, rev);
      }
      refresh(txt: ex.Context, rev: boolean) {
         this.operations = ex.Trace.interpret(txt.trace);
         this.first = txt;
      }
      channels(): pt.Channel[][] {
         return this.operations.map(e => e.map(e => e.channel));
      }
      protected setSelected0(p: [number, number]) {
         super.setSelected0(p);
         this.code.hiOp = p[1];
         this.code.hiChannel = this.channels()[p[0]];
         this.exec.set(this.operations[p[0]][p[1]]);
      }
   }

   export class Shell extends sh.Shell {
      readonly userOptions = new en.UserOptions();
      constructor(readonly parent: ui2.Elem) {
         super();
      }
      newCode() {
         return new en.Code("", new pt.Seq());
      }
      resetExec() {
         let ret = super.resetExec();
         if (this.model) {
            (this.model as en.Code).compiled = null;
            (this.model as en.Code).reverseCompiled = null;
         }
         return ret;
      }
      toggleCodeVisible(e: en.Code): boolean {
         if (this.userOptions.has(e))
            this.userOptions.delete(e);
         else {
            if (!e.output)
               e.setOutput();
            this.userOptions.add(e);
         }
         return true;
      }
      isCodeVisible(e: en.Code) { return this.userOptions.has(e); }
   }
}
namespace en {
   export interface Code extends sh.CodeModel {
      execs0: ex.Context[];
   }
   Code.prototype.makeRender = function (parent) {
      let self = this as Code;
      return new ptrn.Code(parent, self);
   }
   Code.prototype.execs = function () {
      let self = this as Code;
      if (!self.execs0) {
         if (self.input.children.length == 0)
            return [];
         let r = new Random(42);
         self.execs0 = [];
         let set = new Set<string>();
         // we want 20 tests.
         let ncases = 20;
         let limit = 5;
         let skip = 0;
         while (self.execs0.length < ncases) {
            let [a, b] = self.input.randExeme(r, limit);
            let key = "K:" + b.format();
            if (set.has(key)) {
               skip += 1;
               if (skip >= ncases) {
                  if (limit >= ncases)
                     break; // give up.
                  limit += 5;
               }
               continue;
            }
            set.add(key);
            skip = 0;
            let aS = a instanceof ex.Seq ? (a as ex.Seq).children : [a];
            let txt = new ex.Context(0, b.length, b, aS, pt.RootChannel, pt.RootUnify.doConsolidate(), [new ex.Trace(self, false)]);
            //et txt0 = self.exec(txt, false, true);
            self.execs0.push(txt);
         }
         for (let txt of self.execs0) {
            let used = new Array<number>();
            for (let i = 0; i < txt.data.length; i += 1)
               used.push(i);
            for (let i = 0; i < txt.data.length; i += 1) {
               let k = r.nextN(used.length);
               (k >= 0 && k < used.length).assert();
               txt.data[i] = txt.data[i] + "" + pt.convertToSub(used[k]);
               used.splice(k, 1);
            }
            (used.length == 0).assert();
            let j = 0;
            for (let i = 0; i < txt.exemes.length; i += 1) {
               let nj = j + txt.exemes[i].length;
               let e = self.input.children[i];
               if (e instanceof ss.Ordered) {
                  let slice = txt.data.slice(j, nj) as string[];
                  let pe = e.ascending ? +1 : -1;


                  slice = slice.sort((a, b) => {
                     let a0 = pt.convertToNumber(a.substr(1, a.length));
                     let b0 = pt.convertToNumber(b.substr(1, b.length));
                     return (a0 - b0) * pe;
                  });
                  for (let k = j; k < nj; k += 1)
                     txt.data[k] = slice[k - j];
               }
               j = nj;

            }

         }
      }
      return self.execs0;
   }
   Code.prototype.makeExec = function (parent, code, txt) {
      let self = this as Code;
      let txt0 = txt as any as ex.Context;
      txt0.trace.clear();
      txt0.trace.push(new ex.Trace(self, false));
      self.exec(txt0, false, true);
      let exec = new ptrn.ExecRoot(parent, txt0);
      let timeline = new ptrn.Timeline(parent, code as ptrn.Code, exec, txt0, false);
      return [timeline, exec];
   }
}
namespace ex {
   export interface Context extends sh.Exec { }

   Context.prototype.render = function (parent) {
      let self = this as Context;
      return new rn.PopupLabel(self.data.format(a => "" + a, ""));
   }
}