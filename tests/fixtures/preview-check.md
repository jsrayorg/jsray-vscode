# JSRay 预览自查

装上扩展后打开这个文件，按 ⌘⇧V 打开 Markdown 预览，逐条对照。

---

## 1. 回归本体（最该看的一条）

修复前：注释在撇号处断掉，`don` 之后的内容被当成代码渲染。
现在应当：整行都是注释色，而 `'static` 仍高亮为类型。

```rust
fn main() {
    // don't do this — the apostrophe used to end the comment here
    let s: &'static str = "hi";
    let t: &'a str = s;          // it's fine now
}
```

## 2. 生命周期没有被修坏

两个生命周期之间的代码不应被吞掉。

```rust
struct Foo<'a> { s: &'a str }

impl<'a> Foo<'a> {
    fn get(&self) -> &'a str { self.s }
}
```

## 3. 字符串里的 `//` 不该变成注释

```javascript
const url = "https://jsray.org/paste";   // 真正的注释在这里
const re = /^[a-z]+$/i;
```

## 4. 九类标识符是否可区分

参数 / 系统变量 / 常量 / 函数声明 / 函数调用 / 内置函数 / 类型 / 属性。

```typescript
interface User { id: number; name: string }

async function fetchUser(id: number): Promise<User> {
  const MAX_RETRY = 3;
  const res = await fetch(`/api/users/${id}`);
  console.log(res.status);
  return res.json();
}
```

## 5. 其它语言抽查

```python
@dataclass
class Article:
    title: str
    views: int = 0

    def popular(self) -> bool:
        # 超过一千次浏览算热门
        return self.views > 1_000
```

```sql
SELECT id, 'it''s quoted' AS note FROM posts WHERE views > 100;
```

```diff
@@ -1,3 +1,3 @@
-const old = 1;
+const new = 2;
```
