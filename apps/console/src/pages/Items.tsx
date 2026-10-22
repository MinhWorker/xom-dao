import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Item, type ItemList, type ItemSlot } from '../api';
import { Dialog, Field, message, useSubmit } from '../Dialog';

const SLOT_NAMES: Record<ItemSlot, string> = {
  avatar: 'Ảnh đại diện',
  frame: 'Khung',
  'card-back': 'Lưng bài',
  emote: 'Biểu cảm',
};

type Editing = { kind: 'create' } | { kind: 'edit'; item: Item } | { kind: 'delete'; item: Item };

const priceFormat = new Intl.NumberFormat('vi-VN');

/** Vật phẩm: the items sold at Chợ (and the free ones everyone has). */
export function Items() {
  const [data, setData] = useState<ItemList | null>(null);
  const [loadError, setLoadError] = useState('');
  const [slot, setSlot] = useState<ItemSlot | 'all'>('all');
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(() => {
    api.items().then(
      (result) => {
        setData(result);
        setLoadError('');
      },
      (err: unknown) => setLoadError(message(err)),
    );
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(
    () => data?.items.filter((item) => slot === 'all' || item.slot === slot) ?? [],
    [data, slot],
  );
  const done = () => {
    setEditing(null);
    load();
  };

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Vật phẩm</h1>
          <p className="muted">{data ? `${data.items.length} món` : 'Đang tải…'}</p>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!data}
          onClick={() => setEditing({ kind: 'create' })}
        >
          Thêm món
        </button>
      </header>

      <div className="toolbar tabs" role="tablist">
        {(['all', ...(data?.slots ?? [])] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={slot === s}
            className={slot === s ? 'tab active' : 'tab'}
            onClick={() => setSlot(s)}
          >
            {s === 'all' ? 'Tất cả' : SLOT_NAMES[s]}
          </button>
        ))}
      </div>

      {loadError && <p className="error">{loadError}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th className="hide-sm">Mã</th>
              <th className="hide-sm">Loại</th>
              <th className="hide-sm">Hình</th>
              <th className="num">Giá</th>
              <th aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="hide-sm mono muted">{item.id}</td>
                <td className="hide-sm">{SLOT_NAMES[item.slot] ?? item.slot}</td>
                <td className="hide-sm mono">{item.look}</td>
                <td className="num">
                  {item.price === 0 ? (
                    <span className="badge">Miễn phí</span>
                  ) : (
                    `${priceFormat.format(item.price)} xu`
                  )}
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setEditing({ kind: 'edit', item })}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="ghost small danger-text"
                    onClick={() => setEditing({ kind: 'delete', item })}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {data && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Chưa có món nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && editing?.kind === 'create' && (
        <ItemForm list={data} onClose={() => setEditing(null)} onDone={done} />
      )}
      {data && editing?.kind === 'edit' && (
        <ItemForm list={data} item={editing.item} onClose={() => setEditing(null)} onDone={done} />
      )}
      {editing?.kind === 'delete' && (
        <DeleteItem item={editing.item} onClose={() => setEditing(null)} onDone={done} />
      )}
    </section>
  );
}

interface FormProps {
  onClose: () => void;
  onDone: () => void;
}

/** Adds an item, or edits one (`item`); its id is fixed once made. */
function ItemForm({ list, item, onClose, onDone }: FormProps & { list: ItemList; item?: Item }) {
  const firstSlot = list.slots[0] ?? 'avatar';
  const [slot, setSlot] = useState<ItemSlot>(item?.slot ?? firstSlot);
  const [look, setLook] = useState(item?.look ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(String(item?.price ?? 0));
  const [id, setId] = useState(item?.id ?? '');
  const [idTouched, setIdTouched] = useState(Boolean(item));
  const { busy, error, run } = useSubmit(onDone);

  // Looks another item already gives can't be picked again.
  const taken = useMemo(
    () =>
      new Set(
        list.items
          .filter((other) => other.slot === slot && other.id !== item?.id)
          .map((other) => other.look),
      ),
    [list, slot, item],
  );
  const looks = list.looks[slot] ?? [];

  const suggestedId = look ? `core:${slot}-${look}` : '';
  const shownId = idTouched ? id : suggestedId;

  return (
    <Dialog
      title={item ? `Sửa ${item.name}` : 'Thêm món'}
      submitLabel={item ? 'Lưu' : 'Tạo'}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        const fields = { slot, look, name, price: Number(price) };
        run(() =>
          item ? api.updateItem(item.id, fields) : api.createItem({ id: shownId, ...fields }),
        );
      }}
    >
      <Field label="Loại">
        <select
          value={slot}
          onChange={(e) => {
            setSlot(e.target.value as ItemSlot);
            setLook('');
          }}
        >
          {list.slots.map((s) => (
            <option key={s} value={s}>
              {SLOT_NAMES[s] ?? s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Hình">
        <select value={look} onChange={(e) => setLook(e.target.value)} required>
          <option value="" disabled>
            Chọn hình
          </option>
          {looks.map((l) => (
            <option key={l} value={l} disabled={taken.has(l)}>
              {taken.has(l) ? `${l} (đã có món)` : l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tên">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
      </Field>
      <Field label="Giá (xu, 0 = miễn phí)">
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </Field>
      <Field label="Mã món">
        <input
          className="mono"
          value={shownId}
          disabled={Boolean(item)}
          onChange={(e) => {
            setIdTouched(true);
            setId(e.target.value);
          }}
          required
        />
      </Field>
    </Dialog>
  );
}

function DeleteItem({ item, onClose, onDone }: FormProps & { item: Item }) {
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      title="Xoá món?"
      submitLabel="Xoá"
      danger
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api.deleteItem(item.id))}
    >
      <p>
        <strong>{item.name}</strong> sẽ biến mất khỏi Chợ và Túi đồ của người đã mua. Ai đang đeo
        thì vẫn giữ tới khi đổi.
      </p>
    </Dialog>
  );
}
