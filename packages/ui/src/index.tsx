import type {ButtonHTMLAttributes,ReactNode} from 'react';
import styles from './ui.module.css';
export function Button({children,variant='primary',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'quiet'}){return <button {...props} className={`${styles.button} ${variant==='quiet'?styles.quiet:''} ${props.className||''}`}>{children}</button>}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){return <div className={`${styles.notice} ${error?styles.error:''}`} role={error?'alert':'status'}>{children}</div>}
export function Empty({title,children}:{title:string;children:ReactNode}){return <div className={styles.empty}><span className={styles.circle}>↗</span><h3>{title}</h3><p>{children}</p></div>}
