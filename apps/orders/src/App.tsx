import {useEffect,useState} from 'react';
import {api,money,type AppProps,type Order} from '@lab/platform';
import {Button,Notice,Empty} from '@lab/ui';
import styles from './orders.module.css';
export default function Orders({platform,path}:AppProps){
  const [orders,setOrders]=useState<Order[]>([]),[detail,setDetail]=useState<Order|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const id=path.replace(/^\/orders\/?/,'');
  useEffect(()=>{
    let active=true;
    const refresh=()=>{setLoading(true);setError('');api<Order[]|Order>(id?`/orders/${encodeURIComponent(id)}`:'/orders').then(result=>{if(active){if(id)setDetail(result as Order);else setOrders(result as Order[])}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})};
    if(platform.user)refresh();else setLoading(false);
    const unsubscribe=platform.subscribe(event=>{if(event.type==='order:created')refresh()});
    return()=>{active=false;unsubscribe()};
  },[id,platform.user?.id]);
  return <section className={styles.orders} aria-label="Orders application"><div className={styles.heading}><div><span className={styles.eyebrow}>YOUR COLLECTION</span><h2>{id?'A closer look.':'Small things, kept.'}</h2><p>Orders are stored on the server and belong to your account.</p></div><span className={styles.version}>orders · {__APP_VERSION__}</span></div>
    {!platform.user?<Empty title="Your orders live here."><Button onClick={()=>platform.navigate('/login')}>Sign in to see your orders</Button></Empty>:error?<Notice error>{error}</Notice>:loading?<Notice>Reading your orders from the database…</Notice>:id&&detail?<div className={styles.detail}><button className={styles.back} onClick={()=>platform.navigate('/orders')}>← All orders</button><h3>{detail.product_name}</h3><dl><dt>Order ID</dt><dd>{detail.id}</dd><dt>Quantity</dt><dd>{detail.quantity}</dd><dt>Total</dt><dd>{money(detail.unit_price*detail.quantity)}</dd><dt>Created</dt><dd>{new Date(detail.created_at).toLocaleString()}</dd><dt>Status</dt><dd>Saved · no payment collected</dd></dl><Notice>This nested route is owned by Orders. Refresh this page: the server serves the shell, which loads Orders and its detail screen.</Notice></div>:orders.length?<><div className={styles.summary}><span>{orders.length} saved {orders.length===1?'order':'orders'}</span><strong>{money(orders.reduce((sum,o)=>sum+o.unit_price*o.quantity,0))}</strong></div><div className={styles.list}>{orders.map(order=><button key={order.id} className={styles.row} onClick={()=>platform.navigate(`/orders/${order.id}`)}><span className={styles.mark}>{order.product_name.slice(0,1)}</span><span><strong>{order.product_name}</strong><small>{new Date(order.created_at).toLocaleDateString()} · Quantity {order.quantity}</small></span><b>{money(order.quantity*order.unit_price)}</b><span>↗</span></button>)}</div></>:<Empty title="Start with something small.">Place an order in the catalog. It will appear here, even after you restart the app.<br/><br/><Button onClick={()=>platform.navigate('/catalog')}>Explore the collection</Button></Empty>}
    <div className={styles.foot}><code>GET {id?'/api/orders/:id':'/api/orders'}</code><span>The backend checks the session and filters by user ID.</span></div>
  </section>
}
