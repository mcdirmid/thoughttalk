namespace ex {
   export abstract class Exeme {
      abstract get adbg(): string;
      toString() { return this.adbg; }
      abstract get pattern(): pt.Pattern;
      abstract get length(): number;
      get isEmpty() { return this.length == 0; }
      equals(other: Exeme): boolean {
         return this.pattern.execEquals(other.pattern) && this.length == other.length;
      }
      abstract update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme;
   }
   export interface EmptyExeme extends Exeme, ValidateExeme {
      readonly length: 0;
      readonly pattern : pt.Pattern;
   }
   export interface ValidateExeme extends Exeme {
      readonly canValidate: boolean;
      check(data: any[], idx: number): boolean;
   }


   export class Term extends Exeme {
      get adbg() { return this.pattern.toString(); }
      constructor(readonly pattern: pt.Term) {
         super();
      }
      get length() { return 1; }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         (at == path.length).assert();
         return f(this, path, at);
      }
   }
   export class BlankTerm extends Term implements ValidateExeme {
      get canValidate() { return true; }
      get value() { return this.pattern.toString().toUpperCase(); }
      check(data: any[], idx: number) {
         return data[idx].startsWith(this.value);
      }
   }
   export class CustomTerm extends Term implements ValidateExeme {
      get canValidate() { return true; }
      //get value() { return this.pattern.toString().toUpperCase(); }
      get adbg() { return super.adbg + this.label; }
      constructor(term: pt.Term, readonly label: string, readonly f: (d: any) => boolean) {
         super(term);
      }
      check(data: any[], idx: number) { return this.f(data[idx]); }
   }


   export abstract class Star extends Exeme {
      abstract get pattern(): pt.StarLike;
      abstract addToRight(inner: Exeme): NonEmptyStar;
      abstract addToLeft(inner: Exeme): NonEmptyStar;
      abstract addToLeftStar(inner: Star): Star;
   }
   export class EmptyStar extends Star implements EmptyExeme {
      get adbg() { return "[]*"; }
      constructor(readonly pattern: pt.StarLike) {
         super();
         (pattern != null).assert();
      }
      get length(): 0 { return 0; }
      isSame(other: Exeme) { return other instanceof EmptyStar; }
      addToRight(inner: Exeme) {
         inner.pattern.execEquals(this.pattern.child).assert();
         return new UniformStar(1, /*this.pattern,*/ inner);
      }
      addToLeft(inner: Exeme) { return this.addToRight(inner); }
      addToLeftStar(right: Star): Star { return right; }

      get canValidate() { return true; }
      check() { return true; }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         return f(this, path, at); // no where to go!
      }
   }
   export abstract class NonEmptyStar extends Star {
      abstract divideLeft(): [Exeme, Star];
      abstract divideRight(): [Star, Exeme];
      addToRight(inner: Exeme): NonEmptyStar {
         return new NonUniformLeft(inner, this);
      }
      addToLeft(inner: Exeme): NonEmptyStar {
         return new NonUniformRight(this, inner);
      }
      addToLeftStar(inner: Star): NonEmptyStar {
         if (inner.length == 0)
            return this;
         else return new NonUniformStar(this, inner as NonEmptyStar);
      }
   }


   export class UniformStar extends NonEmptyStar {
      readonly length: number;
      get adbg() { return "[" + this.inner.adbg + "*" + this.n + "]"; }
      get pattern() { return this.inner.pattern.star(); }
      constructor(readonly n: number, readonly inner: Exeme) {
         super();
         (this.n >= 0).assert();
         this.length = this.n * this.inner.length;
      }
      equals(other: Exeme): boolean {
         if (!super.equals(other) || !(other instanceof UniformStar))
            return false;
         return this.inner.equals((other as UniformStar).inner);
      }
      private divide() {
         return this.n > 1 ? new UniformStar(this.n - 1, /*this.pattern,*/ this.inner) : new EmptyStar(this.pattern);
      }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         if (at == path.length)
            return f(this, path, at); // no where to go!
         (path[at] == 0).assert();
         let newInner = this.inner.update(path, at + 1, f);
         return new UniformStar(this.n, newInner);
      }

      divideLeft(): [Exeme, Star] {
         return [this.inner, this.divide()];
      }
      divideRight(): [Star, Exeme] {
         return [this.divide(), this.inner];
      }
      addToRight(inner: Exeme): NonEmptyStar {
         if (inner.equals(this.inner))
            return new UniformStar(this.n + 1, /*this.pattern,*/ this.inner);
         else return super.addToRight(inner);
      }
      addToLeft(inner: Exeme): NonEmptyStar {
         if (inner.equals(this.inner))
            return new UniformStar(this.n + 1, /*this.pattern,*/ this.inner);
         return super.addToLeft(inner);
      }
      addToLeftStar(inner: Star): NonEmptyStar {
         if (inner instanceof UniformStar && inner.inner.equals(this.inner))
            return new UniformStar(this.n + inner.n, /*this.pattern,*/ this.inner);
         return super.addToLeftStar(inner);
      }
   }
   export class NonUniformStar extends NonEmptyStar {
      readonly length: number;
      get adbg() { return this.left + "::" + this.right; }
      constructor(readonly left: NonEmptyStar, readonly right: NonEmptyStar) {
         super();
         this.length = this.left.length + this.right.length;
         this.left.pattern.execEquals(this.right.pattern).assert();
      }
      get pattern(): pt.StarLike { return this.right.pattern; }
      divideLeft(): [Exeme, NonEmptyStar] {
         let [e, s] = this.left.divideLeft();
         return [e, s.addToLeftStar(this.right) as NonEmptyStar];
      }
      divideRight(): [NonEmptyStar, Exeme] {
         let [s, e] = this.right.divideRight();
         return [this.left.addToLeftStar(s), e];
      }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         (at == path.length || path[at] == 0).assert();
         let left = this.left.update(path, at, f);
         let right = this.right.update(path, at, f);
         if (left instanceof NonEmptyStar && right instanceof NonEmptyStar) {
            let ret = new NonUniformStar(left, right);
            return at == path.length ? f(ret, path, at) : ret;
         }
         else throw new Error();
      }
   }

   export class NonUniformLeft extends NonEmptyStar {
      readonly length: number;
      get adbg() { return "[" + this.left + "]:" + this.right; }
      constructor(readonly left: Exeme, readonly right: NonEmptyStar) {
         super();
         this.length = this.left.length + this.right.length;
         this.right.pattern.child.execEquals(this.left.pattern).assert();
      }
      get pattern(): pt.StarLike { return this.right.pattern; }
      divideLeft(): [Exeme, Star] { return [this.left, this.right]; }
      divideRight() {
         let ret = this.right.divideRight();
         ret[0] = ret[0].addToRight(this.left);
         return ret;
      }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         (at == path.length || path[at] == 0).assert();
         let right = this.right.update(path, at, f);
         if (!(right instanceof NonEmptyStar))
            throw new Error();
         if (at == path.length) {
            let self = new NonUniformLeft(this.left, right);
            return f(self, path, at);
         }
         let left = this.left.update(path, at + 1, f);
         return new NonUniformLeft(left, right);
      }
   }
   export class NonUniformRight extends NonEmptyStar {
      readonly length: number;
      get adbg() { return this.left + ":[" + this.right + "]"; }
      constructor(readonly left: NonEmptyStar, readonly right: Exeme) {
         super();
         this.length = this.left.length + this.right.length;
         this.left.pattern.child.execEquals(this.right.pattern).assert();
      }
      get pattern(): pt.StarLike { return this.left.pattern; }
      divideRight(): [Star, Exeme] { return [this.left, this.right]; }
      divideLeft() {
         let ret = this.left.divideLeft();
         ret[1] = ret[1].addToLeft(this.right);
         return ret;
      }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         (at == path.length || path[at] == 0).assert();
         let left = this.left.update(path, at, f);
         if (!(left instanceof NonEmptyStar))
            throw new Error();
         if (at == path.length) {
            let self = new NonUniformRight(left, this.right);
            return f(self, path, at);
         }
         let right = this.right.update(path, at + 1, f);
         return new NonUniformRight(left, right);
      }

   }

   export abstract class Opt extends Exeme {
      abstract get pattern(): pt.Opt;
   }
   export class EmptyOpt extends Opt implements EmptyExeme {
      get adbg() { return "[]?" }
      constructor(readonly pattern: pt.Opt) {
         super();
         (pattern != null).assert();
      }
      get length(): 0 { return 0; }
      get canValidate() { return true; }
      check() { return true; }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         (at == path.length || path[at] == 0).assert();
         return f(this, path, at);
      }

   }
   export class NonEmptyOpt extends Opt {
      get adbg() { return "[" + this.inner + "]" }
      get pattern() { return this.inner.pattern.opt(); }
      constructor(readonly inner: Exeme) {
         super();
      }
      get length() { return this.inner.length; }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         if (path.length == at)
            return f(this, path, at);
         (path[at] == 0).assert();
         let newInner = this.inner.update(path, at + 1, f);
         return new NonEmptyOpt(newInner);
      }
   }

   export abstract class Or extends Exeme {
      abstract get pattern(): pt.Or;
      abstract eval(data: any[], idx: number): [number, Exeme, pt.OrTag];
   }
   export class ComputedOr extends Or implements ValidateExeme {
      get adbg() { return "[" + this.children.format(a => a.adbg, " | ") + "]"; }
      readonly length: number;
      get pattern() {
         return new pt.Or(this.children.map(c => c.pattern), this.tags);
      }
      constructor(readonly children: ValidateExeme[], readonly tags: pt.OrTag[]) {
         super();
         (this.children.length == this.pattern.children.length).assert();
         this.length = this.children[0].length;
         for (let i = 0; i < this.children.length; i += 1)
            (this.children[i].canValidate && this.children[i].pattern.execEquals(this.pattern.children[i]) && this.children[i].length == this.length).assert();
      }
      get canValidate() { return true; }
      check(data: any[], idx: number) {
         for (let e of this.children)
            if (e.check(data, idx))
               return true;
         return false;
      }
      eval(data: any[], idx: number): [number, Exeme, pt.OrTag] {
         for (let i = 0; i < this.children.length; i += 1)
            if (this.children[i].check(data, idx))
               return [i, this.children[i], this.tags[i]];
         throw new Error();
      }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         if (path.length == at)
            return f(this, path, at);
         let cS = this.children.copy();
         let newC = cS[path[at]].update(path, at + 1, f);
         if (!(newC as ValidateExeme).canValidate)
            throw new Error();
         cS[path[at]] = newC as ValidateExeme;
         return new ComputedOr(cS, this.tags);
      }


   }




   export class Seq extends Exeme implements ValidateExeme {
      readonly length: number;
      constructor(readonly children: Exeme[]) {
         super();
         this.length = this.children.mapi(c => c.length).sum();
         (this.length > 0).assert();
         (this.children.length > 1).assert();
         (this.children.length == this.pattern.children.length).assert();
         for (let i = 0; i < this.children.length; i += 1)
            (this.children[i].pattern.execEquals(this.pattern.children[i])).assert();
      }
      get pattern() {
         return new pt.Seq(...this.children.map(c => c.pattern));
      }


      get adbg() { return this.children.format(a => a.adbg, "."); }
      get canValidate(): boolean { return this.children.every(e => (e as ValidateExeme).canValidate); }
      check(data: any[], idx: number) {
         for (let e of this.children) {
            if (!(e as ValidateExeme).check(data, idx))
               return false;
            idx += e.length;
         }
         return true;
      }
      update(path: number[], at: number, f: (a: Exeme, path: number[], at: number) => Exeme): Exeme {
         if (path.length == at)
            return f(this, path, at);
         let cS = this.children.copy();
         let newC = cS[path[at]].update(path, at + 1, f);
         cS[path[at]] = newC;
         return new Seq(cS);
      }
   }


}
namespace ex {
   export class Trace extends Object {
      constructor(readonly code : en.Code, readonly rev : boolean) { super(); }
      readonly entries = new Array<[number, Context]>();
      readonly nested = new Map<number, Trace[]>();
      /*
      static interpret11(traces: Trace[], code: en.Code, rev: boolean, input: pt.Root) {
         let stream = rev ? code.reverseCompiled : code.compiled;
         let ret: [number, Context][] = [];

         for (let trace of traces) {
            for (let [a, b] of trace.entries) {
               let a0 = stream[a].oprIndex;
               let input = a0 > 0 ? code.operations[a0 - 1][1] : null;
               //let output = code.operations[a0][1];
               if (stream[a].output) {
                  let live = stream[a].output.liveNow;
                  if (input)
                     live.adds(...input.liveNow);
                  let p = b.channel;
                  while (!live.has(p))
                     p = p.parent;
                  if (p != b.channel) {
                     (p.name != b.channel.name).assert();
                     b = new ex.Context(b.start, b.end, b.data, b.exemes, p, b.unify, b.trace);
                  }
               }


               ret.push([a0, b]);
            }
         }
         return ret;

      }
      */
      static interpret(traces: Trace[]) {
         let code = traces[0].code;
         let rev = traces[0].rev;
         let ret: Context[][] = [];
         let stream = rev ? code.reverseCompiled : code.compiled;
         for (let i = 0; i < traces.length; i += 1) {
            ret.push(new Array<Context>(code.operations.length));
            let r0 = ret.last();
            for (let [a, b] of traces[i].entries) {
               let a0 = stream[a].oprIndex;
               let input = a0 > 0 ? code.operations[a0 - 1][1] : null;
               if (stream[a].output) {
                  let live = stream[a].output.liveNow;
                  if (input)
                     live.adds(...input.liveNow);
                  let p = b.channel;
                  while (!live.has(p))
                     p = p.parent;
                  if (p != b.channel) {
                     (p.name != b.channel.name).assert();
                     b = new ex.Context(b.start, b.end, b.data, b.exemes, p, b.unify, b.trace);
                  }
               }
               r0[a0] = b;
            }
            (r0.length == code.operations.length);
         }
         (ret.length == traces.length).assert();
         for (let nested of flatten(traces.mapi(e => e.nested.values()))) {
            if (nested[0].code == code) {
               let ret0 = Trace.interpret(nested);
               for (let k of ret0)
                  if (k[0].start < k[0].end)
                     ret.push(...[k]);
            }
         }
         return ret;
      }







   }



   export class Context extends Object {
      get adbg() { return this.exemes.format(a => a.adbg, "."); }
      toString() { return this.adbg; }
      private offsets0: number[];
      readonly loopAt: number;
      constructor(
         readonly start: number,
         readonly end: number,
         readonly data: any[],
         readonly exemes: Exeme[],
         readonly channel: pt.Channel,
         readonly unify: pt.Unify,
         readonly trace: Trace[]) {
         super();
         (!this.trace.isEmpty()).assert();
         this.loopAt = this.trace.length - 1;
      }
      get offsets(): number[] {
         if (!this.offsets0) {
            this.offsets0 = [];
            let idx = this.start;
            for (let e of this.exemes) {
               (!(e instanceof Seq)).assert();
               this.offsets0.push(idx);
               idx += e.length;
            }
            (idx == this.end).assert();
            this.offsets0.push(idx);
         }
         return this.offsets0;
      }
      check(seq: pt.Seq) {
         (seq.children.length == this.exemes.length).assert();
         for (let i = 0; i < seq.children.length; i += 1)
            seq.children[i].execEquals(this.exemes[i].pattern).assert();
      }
      swap(idx: number, jdx: number) {
         let data = this.data.copy();
         let exemes = this.exemes.copy();
         (this.exemes[idx].length == this.exemes[jdx].length && this.exemes[idx].length == 1).assert();
         {
            let i = this.offsets[idx];
            let j = this.offsets[jdx];
            let temp = data[i];
            data[i] = data[j];
            data[j] = temp;
         }
         {
            let temp = exemes[idx];
            exemes[idx] = exemes[jdx];
            exemes[jdx] = temp;
         }
         // also must swap exemes!
         return new Context(this.start, this.end, data, exemes, this.channel, this.unify, this.trace);
      }
      replace(idx: number, len: number, add: Exeme[], channel?: pt.Channel) {
         let exemes = this.exemes.copy();
         // add = flatten(add.mapi(e => e instanceof Seq ? e.children : [e])).toArray();
         exemes.splice(idx, len, ...add);
         return new Context(this.start, this.end, this.data, exemes, channel ? channel : this.channel, this.unify, this.trace);
      }
      toStarRight(idx: number) {
         let a = (this.exemes[idx + 1] as Star).addToRight(this.exemes[idx]);
         return this.replace(idx, 2, [a])
      }
      toStarRightStar(idx: number) {
         (this.exemes[idx] instanceof Star).assert();
         let a = (this.exemes[idx] as Star).addToLeftStar(this.exemes[idx + 1] as Star);
         return this.replace(idx, 2, [a])
      }
      toStarLeft(idx: number) {
         let a = (this.exemes[idx] as Star).addToLeft(this.exemes[idx + 1]);
         return this.replace(idx, 2, [a])
      }
      toStarLeftStar(idx: number) {
         (this.exemes[idx + 1] instanceof Star).assert();
         let a = (this.exemes[idx] as Star).addToLeftStar(this.exemes[idx + 1] as Star);
         return this.replace(idx, 2, [a])
      }

      upStar(idx: number, pattern: pt.StarLike) {
         return this.replace(idx, 0, [new EmptyStar(pattern.execEqVal.replace(this.unify) as pt.Star)]);
      }
      // up? and negative case of to?
      upOpt(idx: number, pattern: pt.Opt) {
         return this.replace(idx, 0, [new EmptyOpt(pattern.replace(this.unify) as pt.Opt)]);
      }
      // positive case of to?
      toOpt(idx: number, len: number, pattern: pt.Opt) {
         pattern = pattern.replace(this.unify) as pt.Opt;
         let xS = this.exemes.slice(idx, idx + len);
         let a = xS.length == 1 ? xS[0] : new Seq(xS);
         let b = new NonEmptyOpt(/*pattern,*/ a);
         return this.replace(idx, len, [b]);
      }
      branchStarLeft(idx: number, ifTrue: pt.Channel, ifFalse: pt.Channel, isSeq: boolean) {
         if (this.exemes[idx].length == 0)
            return this.replace(idx, 1, [], ifFalse);
         let eS = (this.exemes[idx] as NonEmptyStar).divideLeft();
         // AA*
         true.assert();
         if (isSeq) {
            (eS[0] instanceof Seq).assert();
            return this.replace(idx, 1, (eS[0] as Seq).children.concat(eS[1]), ifTrue);
         } else {
            (!(eS[0] instanceof Seq)).assert();
            return this.replace(idx, 1, eS, ifTrue);
         }
      }
      branchStarRight(idx: number, ifTrue: pt.Channel, ifFalse: pt.Channel, isSeq: boolean) {
         if (this.exemes[idx].length == 0)
            return this.replace(idx, 1, [], ifFalse);
         let eS = (this.exemes[idx] as NonEmptyStar).divideRight();
         // A*A
         true.assert();
         if (isSeq) {
            (eS[1] instanceof Seq).assert();
            return this.replace(idx, 1, [eS[0] as Exeme].concat(...(eS[1] as Seq).children), ifTrue);
         } else {
            (!(eS[1] instanceof Seq)).assert();
            return this.replace(idx, 1, eS, ifTrue);
         }
      }
      branchOpt(idx: number, ifTrue: pt.Channel, ifFalse: pt.Channel, isSeq: boolean) {
         if (this.exemes[idx].length == 0)
            return this.replace(idx, 1, [], ifFalse);
         let a = (this.exemes[idx] as NonEmptyOpt).inner;
         if (isSeq) {
            (a instanceof Seq).assert();
            return this.replace(idx, 1, (a as Seq).children, ifTrue);
         } else {
            (!(a instanceof Seq)).assert();
            return this.replace(idx, 1, [a], ifTrue);
         }
      }
      branchOr(idx: number, channels: [pt.OrTag, pt.Channel][], isSeq: boolean[]) {
         let or = (this.exemes[idx] as Or);
         let [sel, inner, tag] = or.eval(this.data, this.offsets[idx]);
         let isSeq0 = isSeq[sel];
         for (let [a, cn] of channels) {
            let a0 = this.unify.orTag(a);
            a0 = a0 ? a0 : a;
            if (a0 == tag) {
               if (isSeq0) {
                  (inner instanceof Seq).assert();
                  return this.replace(idx, 1, (inner as Seq).children, cn);
               } else {
                  (!(inner instanceof Seq)).assert();
                  return this.replace(idx, 1, [inner], cn);
               }
            }
         }
         false.assert();
         return null;
      }
      call(idx: number, len: number, unify: pt.Unify, code : en.Code, rev : boolean): Context {
         (len > 0).assert();
         let newStart = this.offsets[idx];
         let newEnd = this.offsets[idx + len];
         let exemes = this.exemes.slice(idx, idx + len);
         let newUnify = this.unify.compose(unify);
         return new Context(newStart, newEnd, this.data, exemes, pt.RootChannel, newUnify, [new Trace(code, rev)]);
      }
      return(idx: number, len: number, nested: Context, pc: number) {
         {
            let newStart = this.offsets[idx];
            let newEnd = this.offsets[idx + len];
            (nested.start == newStart && nested.end == newEnd).assert();
            (nested.offsets[nested.exemes.length] == newEnd).assert();
         }

         let exemes = this.exemes.copy();
         exemes.splice(idx, len, ...nested.exemes);
         (!this.trace.last().nested.has(pc)).assert();
         this.trace.last().nested.set(pc, nested.trace);
         return new Context(this.start, this.end, nested.data, exemes, this.channel, this.unify, this.trace);
      }
      loop(loop: pt.LoopChannel) {
         //this.trace.push(new Trace());
         return new Context(this.start, this.end, this.data, this.exemes, loop, this.unify, this.trace);
      }
   }

   export class Ins extends Object {
      get adbg(): string {
         return this.core.adbg + "@" + this.channel.name + ":" + this.idxS.format() + "#" + this.input;
      }
      toString() { return this.adbg; }
      input: pt.Seq;
      output: pt.Root;
      oprIndex: number = -1;
      // at output. 
      liftFront: number;
      liftBack: number;
      constructor(
         readonly core: InsCore,
         readonly channel: pt.Channel,
         readonly idxS: number[],
      ) {
         super();
         (this.idxS.length == this.core.idxC).assert();
      }
      reverse() {
         let len = this.input.children.length;
         let ret = new Ins(
            this.core.reverse(this),
            this.channel,
            this.idxS.map(i => len - i - this.core.length(this, i)),
         );
         ret.input = this.input.reverse();
         if (this.output)
            ret.output = this.output.reverse();
         ret.oprIndex = this.oprIndex;
         ret.liftFront = this.liftBack;
         ret.liftBack = this.liftFront;
         return ret;
      }
      exec(txt: Context, pc: number): number | Context {
         return this.core.exec(this, txt, pc);
      }
   }
   export abstract class InsCore {
      abstract get idxC(): number;
      abstract get adbg(): string;
      reverse(ins: Ins): InsCore { return this; }
      length(ins: Ins, idx: number) { return 1; }
      abstract exec(ins: Ins, txt: Context, pc: number): number | Context;
   }
   abstract class ToStar extends InsCore {
      get idxC() { return 1; }
      length() { return 2; }
      reverse(): InsCore {
         if (this == ToStarLeft)
            return ToStarRight;
         else if (this == ToStarRight)
            return ToStarLeft;
         else if (this == ToStarLeftStar)
            return ToStarRightStar;
         else if (this == ToStarRightStar)
            return ToStarLeftStar;
         else throw new Error();
      }
      get isStar() { return false; }
   }
   class ToStarLeft0 extends ToStar {
      get adbg() { return "to*←"; }
      exec(ins: Ins, txt: Context) {
         return txt.toStarLeft(ins.idxS[0]);
      }
   }
   class ToStarRight0 extends ToStar {
      get adbg() { return "to*→"; }
      exec(ins: Ins, txt: Context) {
         return txt.toStarRight(ins.idxS[0]);
      }
   }
   export const ToStarLeft: InsCore = new ToStarLeft0();
   export const ToStarRight: InsCore = new ToStarRight0();
   class ToStarLeftStar0 extends ToStar {
      get adbg() { return "to*←*"; }
      exec(ins: Ins, txt: Context) {
         return txt.toStarLeftStar(ins.idxS[0]);
      }
      get isStar() { return true; }
   }
   class ToStarRightStar0 extends ToStar {
      get adbg() { return "to*→*"; }
      exec(ins: Ins, txt: Context) {
         return txt.toStarRightStar(ins.idxS[0]);
      }
      get isStar() { return true; }
   }
   export const ToStarLeftStar: InsCore = new ToStarLeftStar0();
   export const ToStarRightStar: InsCore = new ToStarRightStar0();

   export class ToOpt extends InsCore {
      get adbg() { return "to?"; }
      get idxC() { return 1; }
      length() { return this.len; }
      reverse() { return new ToOpt(this.len, this.pattern.reverse()); }
      constructor(readonly len: number, readonly pattern: pt.Opt) {
         super();
         if (this.pattern.child instanceof pt.Seq)
            (this.len == this.pattern.child.children.length).assert();
         else (this.len == 1).assert();
      }
      exec(ins: Ins, txt: Context) {
         return txt.toOpt(ins.idxS[0], this.len, this.pattern);
      }

   }
   export class UpOpt extends InsCore {
      get adbg() { return "up?"; }
      get idxC() { return 1; }
      length() { return 0; }
      reverse() { return new UpOpt(this.pattern.reverse()); }
      exec(ins: Ins, txt: Context) {
         return txt.upOpt(ins.idxS[0], this.pattern);
      }
      constructor(readonly pattern: pt.Opt) { super(); }
   }
   export class UpStar extends InsCore {
      get adbg() { return "up*"; }
      get idxC() { return 1; }
      length() { return 0; }
      reverse() { return new UpStar(this.pattern.reverse()); }
      exec(ins: Ins, txt: Context) {
         return txt.upStar(ins.idxS[0], this.pattern);
      }
      constructor(readonly pattern: pt.StarLike) { super(); }
   }

   class Swap0 extends InsCore {
      get adbg() { return "swap"; }
      get idxC() { return 2; }
      exec(ins: Ins, txt: Context) {
         let [idx, jdx] = ins.idxS;
         return txt.swap(idx, jdx);
      }
   }
   export const Swap: InsCore = new Swap0();
   /*
   export class Pivot extends InsCore {
      get adbg() { return "pivot"; }
      get idxC() { return 1; }
      constructor(readonly indicies: number[][]) {
         super();
      }
      exec(ins: Ins, txt: Context) {
         let core = txt.exemes[ins.idxS[0]];
         if (!(core instanceof Term))
            throw new Error();
         let idx = txt.offsets[ins.idxS[0]];
         let value = "" + txt.data[idx];
         let h = value.substr(0, 1);
         let r = pt.convertToNumber(value.substr(1, value.length - 1));
         let cmp = (a: any) => {
            let value0 = "" + a;
            let h0 = value0.substr(0, 1);
            let r0 = pt.convertToNumber(value0.substr(1, value0.length - 1));
            h.equals(h0).assert();
            return r0 - r;
         };
         let lo = new CustomTerm(core.pattern, "_lo", d => cmp(d) <= 0);
         let hi = new CustomTerm(core.pattern, "_hi", d => cmp(d) > 0);
         let or = new ComputedOr([lo,hi], [pt.LoPivot, pt.HiPivot]);

         let exemes = txt.exemes.copy();
         for (let path of this.indicies) {
            exemes[path[0]] = exemes[path[0]].update(path, 1, (a, path, at) => {
               if (path.length == at) {
                  if (!a.pattern.execEquals(core.pattern))
                     throw new Error();
                  return or;
               }
               if (a instanceof EmptyStar || a instanceof EmptyOpt) {
                  let p = new pt.Seq(a.pattern);
                  let path0 = path.slice(at, path.length - 1);
                  path0.unshift(...[0, 0]);
                  p = p.update(path0, new pt.Or([core.pattern, core.pattern], [pt.LoPivot, pt.HiPivot]));
                  let q = p.children[0];
                  return a instanceof EmptyStar ? new EmptyStar(q.star()) : new EmptyOpt(q.opt());
               }
               throw new Error();
            })
         }
         return new Context(txt.start, txt.end, txt.data, exemes, txt.channel, txt.unify, txt.trace);
      }
   }
   */

   abstract class Branch extends InsCore {
      abstract get toChannels(): Iterable<pt.Channel>;
      get idxC() { return 1; }
   }
   export abstract class BranchStar extends Branch {
      abstract get ifTrue(): pt.Channel;
      abstract get ifFalse(): pt.Channel;
      abstract get isSeq(): boolean;
      get toChannels() { return [this.ifTrue, this.ifFalse]; }
   }
   export class BranchStarLeft extends BranchStar {
      get adbg() { return "branch*←"; }
      exec(ins: Ins, txt: Context) {
         return txt.branchStarLeft(ins.idxS[0], this.ifTrue, this.ifFalse, this.isSeq)
      }
      constructor(readonly ifTrue: pt.Channel, readonly ifFalse: pt.Channel, readonly isSeq: boolean) {
         super();
      }
      reverse() { return new BranchStarRight(this.ifTrue, this.ifFalse, this.isSeq); }
   }
   export class BranchStarRight extends BranchStar {
      get adbg() { return "branch*→"; }
      exec(ins: Ins, txt: Context) {
         return txt.branchStarRight(ins.idxS[0], this.ifTrue, this.ifFalse, this.isSeq)
      }
      constructor(readonly ifTrue: pt.Channel, readonly ifFalse: pt.Channel, readonly isSeq: boolean) {
         super();
      }
      reverse() { return new BranchStarLeft(this.ifTrue, this.ifFalse, this.isSeq); }
   }
   export class BranchOpt extends Branch {
      get adbg() { return "branch?"; }
      get toChannels() { return [this.ifTrue, this.ifFalse]; }
      exec(ins: Ins, txt: Context) {
         return txt.branchOpt(ins.idxS[0], this.ifTrue, this.ifFalse, this.isSeq)
      }
      constructor(readonly ifTrue: pt.Channel, readonly ifFalse: pt.Channel, readonly isSeq: boolean) {
         super();
      }
   }
   export class BranchOr extends Branch {
      get adbg() { return "branch|"; }
      exec(ins: Ins, txt: Context) {
         return txt.branchOr(ins.idxS[0], this.channels, this.isSeq);
      }
      get toChannels() { return this.channels.map(a => a[1]); }
      constructor(readonly channels: [pt.OrTag, pt.Channel][], readonly isSeq: boolean[]) {
         super();
      }
   }
   export class Call extends InsCore {
      get idxC() { return 1; }
      length() { return this.code.input.children.length; }
      get adbg() { return this.code.name; }
      constructor(readonly code: en.Code, readonly unify: pt.Unify, readonly rev: boolean) {
         super();
      }
      exec(ins: Ins, txt: Context, pc: number) {
         let txt0 = txt.call(ins.idxS[0], this.length(), this.unify, this.code, this.rev);
         let txt1 = this.code.exec(txt0, this.rev);
         return txt.return(ins.idxS[0], this.length(), txt1, pc);
      }
      reverse() {
         return new Call(this.code, this.unify, !this.rev);
      }
   }
   export class Loop extends InsCore {
      get adbg() { return "loop"; }
      get idxC() { return 0; }
      constructor(readonly loop: pt.LoopChannel) {
         super();
      }
      exec(ins: Ins, txt: Context) {
         return txt.loop(this.loop);
      }
   }
   export class Continue extends InsCore {
      get adbg() { return "continue" + this.pc; }
      get idxC() { return 0; }
      constructor(readonly pc: number) {
         super();
      }
      exec(ins: Ins, txt: Context) { return this.pc; }
   }
   class Noop0 extends InsCore {
      get adbg() { return "noop"; }
      exec(ins: Ins, txt: Context) { return txt; }
      get idxC() { return 0; }
   }
   export const Noop = new Noop0();

   export function execIns(txt: Context, oprs: Ins[], check = true, expected?: pt.Seq): Context {
      let pc = 0;
      while (true) {
         if (pc == oprs.length) {
            if (check && expected) {
               (expected.children.length == txt.exemes.length).assert();
               for (let i = 0; i < expected.children.length; i += 1) {
                  let p = expected.children[i].replace(txt.unify);
                  if (!p.execEquals(txt.exemes[i].pattern)) {
                     let expected0 = expected.replace(txt.unify).adbg;
                     let found = new pt.Seq(...txt.exemes.map(e => e.pattern)).adbg;
                     false.assert();
                  }
               }
            }

            return txt;
         }
         let ins = oprs[pc];
         if (!txt.channel.isUnder(ins.channel)) {
            if (false && ins.core instanceof Continue && ins.channel.peers().somei(c => c == txt.channel)) {
               txt.trace.last().entries.push([pc, txt]);
            }
            pc += 1;
            continue;
         }
         if (check) {
            (ins.input.children.length == txt.exemes.length).assert();
            for (let i = 0; i < ins.input.children.length; i += 1) {
               let p = ins.input.children[i].execEqVal.replace(txt.unify);
               if (!p.execEquals(txt.exemes[i].pattern)) {
                  let expected = ins.input.replace(txt.unify).adbg;
                  let found = new pt.Seq(...txt.exemes.map(e => e.pattern)).adbg;
                  let p = ins.input.children[i].replace(txt.unify);
                  false.assert();
               }
            }
         }


         let ret = ins.exec(txt, pc);
         if (txt.trace.last().entries.isEmpty()) { }
         else (txt.trace.last().entries.last()[0] < pc).assert();
         if (typeof ret == "number") {
            //txt.trace.last().entries.push([pc, txt]);
            txt.trace.push(new Trace(txt.trace.last().code, txt.trace.last().rev));
            pc = ret;
         } else {
            // always last one. 
            txt.trace.last().entries.push([pc, ret]);
            txt = ret;
            if (check && ins.output) {
               let output = ins.output.filter(txt.channel).asSeq().execEqVal;
               (output.children.length == txt.exemes.length).assert();
               for (let i = 0; i < output.children.length; i += 1) {
                  let p = output.children[i].execEqVal.replace(txt.unify);
                  if (!p.execEquals(txt.exemes[i].pattern)) {
                     let expected = output.replace(txt.unify).adbg;
                     let found = new pt.Seq(...txt.exemes.map(e => e.pattern)).adbg;
                     let p = output.children[i].replace(txt.unify);
                     false.assert();
                  }
               }
            }

            pc += 1;
         }
      }
   }
}
namespace en {
   export interface Code {
      exec(txt: ex.Context, rev: boolean, nocheck?: boolean): ex.Context;
      compiled: ex.Ins[];
      reverseCompiled: ex.Ins[];
   }
   Code.prototype.exec = function (txt, rev, nocheck) {
      let self = this as Code;
      if (!self.compiled)
         self.compiled = compile(self);
      if (rev && !self.reverseCompiled)
         self.reverseCompiled = self.compiled.map(i => i.reverse());
      let ins = rev ? self.reverseCompiled : self.compiled;
      let expected = rev ? self.output.reverse() : self.output;
      return ex.execIns(txt, ins, nocheck ? false : true, nocheck ? null : expected);
   }


   export interface Operation {
      compile(prevRoot: pt.Root, preStart: number, preEnd: number): Iterable<ex.Ins>;
   }


   function computePre(self: Code) {
      let preS: [pt.Root, number, number][] = [];
      for (let i = 0; i < self.operations.length; i += 1) {
         let op = self.operations[i][0];
         let root = self.operations[i][1];
         if (op instanceof Lift) {
            // find j.
            let j = self.operations.findIndex(([opj, b]) => opj instanceof Loop && opj.toLoop == (op as Lift).loop);
            (j >= 0 && j < i).assert();
            let b = op.dir == "front" ? root.elements.first() : root.elements.last();
            for (let k = j; k < i; k += 1) {
               let eS = preS[k][0].elements.copy();
               if (op.dir == "front") {
                  eS.unshift(b);
                  preS[k][1] += 1;
               } else {
                  eS.push(b);
                  preS[k][2] += 1;
               }
               preS[k][0] = new pt.Root(...eS);
            }
         }
         preS.push([root, 0, 0])
         // extraction is done! 
      }
      return preS;
   }
   function compile(self: Code) {
      let pres = computePre(self);
      let preS = computePre(self);
      let loops = new Map<pt.LoopChannel, number>();
      let prevRoot = pt.Root.make(...self.input.children);
      let oprs: ex.Ins[] = [];
      for (let i = 0; i < self.operations.length; i += 1) {
         let op = self.operations[i][0];
         let [nextRoot, liftFront, liftBack] = preS[i];
         function endBasic() {
            oprs.last().oprIndex = i;
            oprs.last().liftFront = liftFront;
            oprs.last().liftBack = liftBack;
            if (!oprs.last().output)
               oprs.last().output = nextRoot;
         }
         if (op instanceof en.Loop) {
            let oldStart = i > 0 ? preS[i - 1][1] : 0;
            let oldEnd = i > 0 ? preS[i - 1][2] : 0;
            if (oldStart != liftFront || oldEnd != liftBack) {
               (liftFront >= oldStart && liftBack >= oldEnd).assert();
               let front0: pt.StarLike[];
               let back0: pt.StarLike[];
               let liftEnd0: number;
               let oldEnd0: number;
               let eSlength: number;

               {
                  let eS = nextRoot.filter(op.toLoop.parent).elements.copy();
                  eSlength = eS.length;
                  liftEnd0 = eSlength - liftBack;
                  oldEnd0 = eSlength - oldEnd;
                  let front = eS.slice(oldStart, liftFront);
                  let back = eS.slice(liftEnd0, oldEnd0);
                  eS.splice(liftEnd0, oldEnd0 - liftEnd0);
                  eS.splice(oldStart, liftFront - oldStart);
                  {
                     let atRoot = new pt.Root(...eS);
                     if (!atRoot.asSeq().execEquals(prevRoot.asSeq())) {
                        atRoot.asSeq().execEquals(prevRoot.asSeq()).assert();
                     }
                  }
                  front0 = front.map(([a, b]) => {
                     pt.isStarLike(a).assert();
                     (b == (op as en.Loop).toLoop.parent).assert();
                     return a as pt.StarLike;
                  });
                  back0 = back.map(([a, b]) => {
                     pt.isStarLike(a).assert();
                     (b == (op as en.Loop).toLoop.parent).assert();
                     return a as pt.StarLike;
                  });
               }
               let seq = prevRoot.filter(op.toLoop.parent).asSeq();
               let seqAt = seq.children.copy();
               for (let j = oldStart; j < liftFront; j += 1) {
                  let a = front0[j - oldStart];
                  oprs.push(new ex.Ins(new ex.UpStar(a as pt.Star), op.toLoop.parent, [j]));
                  oprs.last().input = new pt.Seq(...seqAt);
                  oprs.last().oprIndex = i;
                  seqAt.splice(j, 0, a);
                  oprs.last().output = null; //new pt.Seq(...seqAt);
                  oprs.last().liftFront = j;
                  oprs.last().liftBack = oldEnd;
               }
               for (let j = liftEnd0; j < oldEnd0; j += 1) {
                  let a = back0[j - liftEnd0];
                  oprs.push(new ex.Ins(new ex.UpStar(a as pt.Star), op.toLoop.parent, [j]));
                  oprs.last().input = new pt.Seq(...seqAt);
                  oprs.last().oprIndex = i;
                  seqAt.splice(j, 0, a);
                  oprs.last().output = null; // new pt.Seq(...seqAt);
                  oprs.last().liftFront = liftFront;
                  oprs.last().liftBack = eSlength - j;
               }
            }
            loops.set(op.toLoop, oprs.length);
            oprs.push(new ex.Ins(new ex.Loop(op.toLoop), op.toLoop.parent, []));
            oprs.last().input = nextRoot.filter(op.toLoop.parent).asSeq();
            endBasic();
         } else if (op instanceof en.Unloop) {
            loops.has(op.loop).assert();
            let pc = loops.get(op.loop);
            oprs.push(new ex.Ins(new ex.Continue(pc), op.channel, []));
            oprs.last().input = prevRoot.filter(op.channel).asSeq();
            endBasic();
         } else {
            let lastChannel = [] as pt.Channel[];
            let insS = op.compile(prevRoot, liftFront, liftBack);
            for (let ins of insS) {
               oprs.push(ins);
               (lastChannel.indexOf(ins.channel) < 0).assert();
               lastChannel.push(ins.channel);
               ins.input = prevRoot.filter(ins.channel).asSeq();
               endBasic();
            }
         }
         prevRoot = nextRoot;
      }
      return oprs;
   }

   EmptyStarOpt.prototype.compile = function (prevRoot, extraStart) {
      let self = this as EmptyStarOpt;
      let ret: ex.Ins[] = [];
      let expected: pt.Pattern
      {
         expected = prevRoot.elements[self.idx + extraStart][0];
         self.check(expected).assert();
      }
      let core = pt.isStarLike(expected) ? new ex.UpStar(expected) :
         expected instanceof pt.Opt ? new ex.UpOpt(expected) : null;
      (core != null).assert();
      for (let pcn of self.channel.peers())
         for (let [cn, jdx] of prevRoot.toLocal(self.idx + extraStart, pcn))
            ret.push(new ex.Ins(core, cn, [jdx]));
      return ret;
   }

   MakeOpt.prototype.compile = function (prevRoot, extraStart) {
      let self = this as MakeOpt;
      let ret: ex.Ins[] = [];
      //let opt = self.len == 1 ? self.expected.children[0].opt() : self.expected.opt();
      let opt: pt.Opt = null;

      for (let [cn, jdx] of prevRoot.toLocal(self.idx + extraStart, self.channel)) {
         let filtered = prevRoot.filter(cn);
         let em = new pt.Seq(...filtered.elements.slice(jdx, jdx + self.len).map(e => e[0]));
         let opt0 = em.children.length == 1 ? em.children[0].opt() : em.opt();
         if (!opt)
            opt = opt0;
         else opt.execEquals(opt0).assert();
         ret.push(new ex.Ins(new ex.ToOpt(self.len, opt), self.channel, [jdx]));
      }
      (opt != null).assert();
      for (let [cn, jdx] of flatten(self.channel.peers().mapi(cn => prevRoot.toLocal(self.idx + extraStart, cn))))
         ret.push(new ex.Ins(new ex.UpOpt(opt), cn, [jdx]));
      return ret;
   }
   Swap.prototype.compile = function (prevRoot, extraStart) {
      let self = this as Swap;
      let ret: ex.Ins[] = [];
      for (let [cn, idx] of prevRoot.toLocal(extraStart + self.idx, self.channel)) {
         for (let [cn0, jdx] of prevRoot.toLocal(extraStart + self.jdx, cn)) {
            ret.push(new ex.Ins(ex.Swap, cn0, [idx, jdx]));
         }
      }
      return ret;
   }
   PopLR.prototype.compile = function (prevRoot, extraStart) {
      let self = this as PopLR;
      let ret: ex.Ins[] = [];
      for (let [cn, idx] of prevRoot.toLocal(extraStart + self.idx, self.channel)) {
         let [star, b] = prevRoot.filter(cn).elements[idx];
         if (!pt.isStarLike(star) || cn != self.channel || b != cn)
            throw new Error();
         let isSeq = star.child instanceof pt.Seq;
         let ifTrue = self.outChannels[0];
         let ifFalse = self.outChannels[1];
         let core = self.dir == "left" ? new ex.BranchStarLeft(ifTrue, ifFalse, isSeq) : new ex.BranchStarRight(ifTrue, ifFalse, isSeq);
         ret.push(new ex.Ins(core, self.channel, [idx]));
      }
      (ret.length == 1).assert();
      return ret;
   }
   Poke.prototype.compile = function (prevRoot, extraStart) {
      let self = this as Poke;
      let ret: ex.Ins[] = [];
      for (let [cn, idx] of prevRoot.toLocal(extraStart + self.idx, self.channel)) {
         let [opt, b] = prevRoot.filter(cn).elements[idx];
         if (!(opt instanceof pt.Opt) || cn != self.channel || b != cn)
            throw new Error();
         let isSeq = opt.child instanceof pt.Seq;
         let ifTrue = self.outChannels[0];
         let ifFalse = self.outChannels[1];
         let core = new ex.BranchOpt(ifTrue, ifFalse, isSeq);
         ret.push(new ex.Ins(core, self.channel, [idx]));
      }
      (ret.length == 1).assert();
      return ret;
   }
   Fork.prototype.compile = function (prevRoot, extraStart) {
      let self = this as Fork;
      let ret: ex.Ins[] = [];
      for (let [cn, idx] of prevRoot.toLocal(extraStart + self.idx, self.channel)) {
         let [or, b] = prevRoot.filter(cn).elements[idx];
         if (!(or instanceof pt.Or) || cn != self.channel || b != cn)
            throw new Error();
         let isSeq = or.children.map(c => c instanceof pt.Seq);
         let map: [pt.OrTag, pt.Channel][] = [];
         for (let i = 0; i < or.children.length; i += 1)
            map.push([or.tags[i], self.outChannels[i]]);
         let core = new ex.BranchOr(map, isSeq);
         ret.push(new ex.Ins(core, self.channel, [idx]));
      }
      (ret.length == 1).assert();
      return ret;
   }
   PushLR.prototype.compile = function (prevRoot, extraStart) {
      let self = this as PushLR;
      let ret: ex.Ins[] = [];
      for (let [cn, idx] of prevRoot.toLocal(extraStart + self.idx, self.channel)) {
         (cn == self.channel).assert();
         let filtered = prevRoot.filter(cn);
         let cA = filtered.elements[self.dir == "left" ? idx + 1 : idx][0];
         let sA = filtered.elements[self.dir == "right" ? idx + 1 : idx][0];
         if (!pt.isStarLike(sA))
            throw new Error();
         let core: ex.InsCore;
         if (pt.isStarLike(cA)) {
            (cA.child.execEquals(sA.child)).assert();
            core = self.dir == "left" ? ex.ToStarLeftStar : ex.ToStarRightStar;
         } else {
            cA.execEquals(sA.child).assert();
            core = self.dir == "left" ? ex.ToStarLeft : ex.ToStarRight;
         }
         ret.push(new ex.Ins(core, self.channel, [idx]));
      }
      (ret.length == 1).assert();
      return ret;
   }
   Loop.prototype.compile = function () { throw new Error() }
   Unloop.prototype.compile = function () { throw new Error() }

   Lift.prototype.compile = function (prevRoot, extraStart, extraEnd) {
      let self = this as Lift;
      let ret: ex.Ins[] = [];
      let idx0 = self.dir == "front" ? extraStart : prevRoot.elements.length - extraEnd - 1;
      for (let [cn, idx] of prevRoot.toLocal(idx0, self.channel)) {
         let filtered = prevRoot.filter(cn);
         let isStar: boolean;
         let sA: pt.Pattern;
         let cA: pt.Pattern;
         if (self.dir == "front") {
            sA = filtered.elements[idx + 0][0];
            cA = filtered.elements[idx + 1][0];
         } else {
            sA = filtered.elements[idx - 0][0];
            cA = filtered.elements[idx - 1][0];
         }
         if (!pt.isStarLike(sA))
            throw new Error();
         else if (pt.isStarLike(cA) && sA.child.execEquals(cA.child))
            isStar = true;
         else {
            (sA.child.execEquals(cA)).assert();
            isStar = false;
         }
         if (!isStar && self.dir == "front")
            ret.push(new ex.Ins(ex.ToStarLeft, cn, [idx + 0]));
         else if (!isStar && self.dir == "back")
            ret.push(new ex.Ins(ex.ToStarRight, cn, [idx - 1]));
         else if (isStar && self.dir == "front")
            ret.push(new ex.Ins(ex.ToStarLeftStar, cn, [idx + 0]));
         else if (isStar && self.dir == "back")
            ret.push(new ex.Ins(ex.ToStarRightStar, cn, [idx - 1]));
         else throw new Error();
      }
      return ret;
   }

   Call.prototype.compile = function (prevRoot, extraStart) {
      let self = this as Call;
      let core = new ex.Call(self.code, self.updatedTxt, self.rev);
      let ret: ex.Ins[] = [];
      for (let [cn, idx] of prevRoot.toLocal(self.idx + extraStart, self.channel)) {
         let filtered = prevRoot.filter(cn);
         let input = filtered.slice(idx, idx + self.code.input.children.length).asSeq();
         if (self.rev)
            input = input.reverse();
         input.execEquals(self.code.input.replace(self.updatedTxt)).assert();
         ret.push(new ex.Ins(core, cn, [idx]));
      }
      return ret;
   }
   Code.prototype.compile = function () {
      return [new ex.Ins(ex.Noop, pt.RootChannel, [])];
   }
   Return.prototype.compile = function () {
      return [
         //new ex.Ins(ex.Noop, pt.RootChannel, [])
      ];
   }
   /*
   Pivot.prototype.compile = function (prevRoot, extraStart) {
      let self = this as Pivot;
      // a pure exeme transformation!
      let ret: ex.Ins[] = [];
      for (let [cn,idx] of prevRoot.toLocal(extraStart + self.idx, self.channel)) {
         let last : [pt.Channel,number[][]][] = [[cn,[]]];
         for (let path of self.indicies) {
            let next : [pt.Channel,number[][]][] = [];
            for (let [cn,paths] of last) {
               for (let [cn0,jdx] of prevRoot.toLocal(extraStart + path[0], cn)) {
                  let path0 = jdx == path[0] ? path : [jdx].concat(...path.slice(1, path.length));
                  let paths0 = paths.copy();
                  paths0.push(path0);
                  next.push([cn0,paths0]);
               }
            }
            last = next;
         }
         for (let [cn,paths] of last) 
            ret.push(new ex.Ins(new ex.Pivot(paths), cn, [idx]));
      }
      return ret;
   }
   */
}

namespace pt {
   export interface Pattern {
      randExeme(r: Random, limit: number): [ex.Exeme, any[]];
   }
   export interface Term {
      exeme: ex.BlankTerm;
   }


   Term.prototype.randExeme = function () {
      let self = this as Term;
      if (!self.exeme)
         self.exeme = new ex.BlankTerm(self);
      return [self.exeme, [self.exeme.value]];
   }
   Seq.prototype.randExeme = function (r, limit) {
      let self = this as Seq;
      let cS = self.children.map(c => c.randExeme(r, limit));
      if (cS.length == 1)
         return cS[0];
      let exeme = new ex.Seq(cS.map(c => c[0]) /*, self */);
      let dS = flatten(cS.map(c => c[1])).toArray();
      (exeme.length == dS.length).assert();
      return [exeme, dS];
   }
   Or.prototype.randExeme = function (r, limit) {
      let self = this as Or;
      let cS = self.children.map(c => c.randExeme(r, limit));
      if (cS.every(c => (c[0] as ex.ValidateExeme).canValidate && c[0].length == cS[0][0].length)) {
         let children = cS.map(c => c[0] as ex.ValidateExeme);
         let choice = r.nextN(children.length);
         return [new ex.ComputedOr(children, /*self,*/ self.tags), cS[choice][1]];
      } else throw new Error();
   }
   Opt.prototype.randExeme = function (r, limit) {
      let self = this as Opt;
      if (r.nextN(2) == 0) {
         let [a, b] = self.child.randExeme(r, limit);
         return [new ex.NonEmptyOpt(/*self,*/ a), b];
      }
      else return [new ex.EmptyOpt(self), []];
   }
   Star.prototype.randExeme = function (r, limit) {
      let self = this as StarLike;
      let n = r.nextN(limit);
      let dS: any[] = [];
      let ret: ex.Star = new ex.EmptyStar(self);
      for (let i = 0; i < n; i += 1) {
         let [a, b] = self.child.randExeme(r, limit);
         ret = ret.addToLeft(a);
         dS.push(...b);
      }
      (ret.length == dS.length).assert();
      return [ret, dS];
   }
    /*
   Ordered.prototype.randExeme = Star.prototype.randExeme;
   Subscript.prototype.randExeme = function (r, limit) {
      return (this as Subscript).child.randExeme(r, limit);
   }
   */
}
