'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown, Wallet, Users, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
const COLORS = ['#34d399', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa', '#f472b6']
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function FinancePage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [salaries, setSalaries] = useState<any[]>([])
  const [currentRevenue, setCurrentRevenue] = useState(0)
  const [chartData, setChartData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseAdd, setShowExpenseAdd] = useState(false)
  const [showSalaryAdd, setShowSalaryAdd] = useState(false)
  
  const [expenseForm, setExpenseForm] = useState({ title: '', category: 'Operations', amount: '', taxAmount: '', date: new Date().toISOString().slice(0,10), status: 'pending' })
  const [salaryForm, setSalaryForm] = useState({ employee: '', role: 'Employee', baseSalary: '', bonus: '', status: 'pending' })
  
  const [deleteExpense, setDeleteExpense] = useState<string | null>(null)
  const [deleteSalary, setDeleteSalary] = useState<string | null>(null)
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null)
  const [editSalaryId, setEditSalaryId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    async function loadFinanceData() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data: dbExpenses, error: expErr } = await supabase.from('expenses').select('*').order('date', { ascending: false })
          if (expErr) {
            toast({ title: 'Error loading expenses', description: expErr.message, variant: 'destructive' })
          } else if (dbExpenses) {
            setExpenses(dbExpenses)
          }

          const { data: dbSalaries, error: salErr } = await supabase.from('salaries').select('*').order('date', { ascending: false })
          if (salErr) {
            toast({ title: 'Error loading salaries', description: salErr.message, variant: 'destructive' })
          } else if (dbSalaries) {
            const mappedSalaries = dbSalaries.map((s: any) => ({
              id: s.id,
              employee: s.employee,
              role: s.role,
              baseSalary: Number(s.base_salary) || 0,
              bonus: Number(s.bonus) || 0,
              status: s.status,
              date: s.date
            }))
            setSalaries(mappedSalaries)
          }

          // Fetch total revenue from paid invoices
          const { data: paidInvoices, error: invErr } = await supabase.from('invoices').select('amount, created').eq('status', 'paid')
          let calculatedRevenue = 0
          if (!invErr && paidInvoices) {
            calculatedRevenue = paidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
          }
          setCurrentRevenue(calculatedRevenue)

          // Group by month for dynamic chart data
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const computedChartData = []
          const today = new Date()
          for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
            const monthName = months[d.getMonth()]
            const year = d.getFullYear()
            const monthStr = String(d.getMonth() + 1).padStart(2, '0')
            
            const monthExp = dbExpenses ? dbExpenses.filter((e: any) => e.date && e.date.startsWith(`${year}-${monthStr}`)) : []
            const expSum = monthExp.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)

            const monthSal = dbSalaries ? dbSalaries.filter((s: any) => s.date && s.date.startsWith(`${year}-${monthStr}`)) : []
            const salSum = monthSal.reduce((sum: number, s: any) => sum + (Number(s.base_salary) + Number(s.bonus || 0)), 0)

            const monthInv = paidInvoices ? paidInvoices.filter((inv: any) => inv.created && inv.created.startsWith(`${year}-${monthStr}`)) : []
            const revSum = monthInv.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0)

            computedChartData.push({
              name: monthName,
              revenue: revSum,
              expenses: expSum + salSum
            })
          }
          setChartData(computedChartData)

          // Category Breakdown Data
          const catMap: Record<string, number> = {}
          if (dbExpenses) {
            dbExpenses.forEach((e: any) => {
              const total = Number(e.amount) + Number(e.tax_amount || 0)
              catMap[e.category] = (catMap[e.category] || 0) + total
            })
          }
          const catChart = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
          setCategoryData(catChart)
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setExpenses([])
        setSalaries([])
        setCurrentRevenue(0)
        setChartData([])
      }
      setLoading(false)
    }
    loadFinanceData()
  }, [])

  const totalExpenses = expenses.reduce((acc, curr) => acc + Number(curr.amount) + Number(curr.tax_amount || 0), 0)
  const totalSalaries = salaries.reduce((acc, curr) => acc + Number(curr.baseSalary) + Number(curr.bonus), 0)
  const netIncome = currentRevenue - totalExpenses - totalSalaries
  const profitMargin = currentRevenue > 0 ? ((netIncome / currentRevenue) * 100).toFixed(1) : '0.0'

  const handleAddExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount) return
    const expenseAmt = Number(expenseForm.amount)
    const taxAmt = Number(expenseForm.taxAmount || 0)
    setSubmitting(true)
    try {
      if (editExpenseId) {
        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('expenses').update({
            title: expenseForm.title,
            category: expenseForm.category,
            amount: expenseAmt,
            tax_amount: taxAmt,
            date: expenseForm.date,
            status: expenseForm.status
          }).eq('id', editExpenseId)
          if (error) {
            toast({ title: 'Error updating expense', description: error.message, variant: 'destructive' })
            return
          }
        }
        setExpenses(expenses.map(e => e.id === editExpenseId ? { ...e, title: expenseForm.title, category: expenseForm.category, amount: expenseAmt, tax_amount: taxAmt, date: expenseForm.date, status: expenseForm.status } : e))
        setEditExpenseId(null)
        toast({ title: 'Expense Updated' })
      } else {
        const newId = Date.now().toString()
        const newExp = {
          id: newId,
          title: expenseForm.title,
          category: expenseForm.category,
          amount: expenseAmt,
          tax_amount: taxAmt,
          date: expenseForm.date,
          status: expenseForm.status
        }
        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('expenses').insert([newExp])
          if (error) {
            toast({ title: 'Error adding expense', description: error.message, variant: 'destructive' })
            return
          }
        }
        setExpenses([...expenses, newExp])
        toast({ title: 'Expense Added' })
      }
      setShowExpenseAdd(false)
      setExpenseForm({ title: '', category: 'Operations', amount: '', taxAmount: '', date: new Date().toISOString().slice(0,10), status: 'pending' })
    } catch (err: any) {
      toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddSalary = async () => {
    if (!salaryForm.employee || !salaryForm.baseSalary) return
    const baseSal = Number(salaryForm.baseSalary)
    const bonusAmt = Number(salaryForm.bonus || 0)
    const todayDate = new Date().toISOString().slice(0,10)
    setSubmitting(true)
    try {
      if (editSalaryId) {
        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('salaries').update({
            employee: salaryForm.employee,
            role: salaryForm.role,
            base_salary: baseSal,
            bonus: bonusAmt,
            status: salaryForm.status,
            date: todayDate
          }).eq('id', editSalaryId)
          if (error) {
            toast({ title: 'Error updating salary record', description: error.message, variant: 'destructive' })
            return
          }
        }
        setSalaries(salaries.map(s => s.id === editSalaryId ? { ...s, employee: salaryForm.employee, role: salaryForm.role, baseSalary: baseSal, bonus: bonusAmt, date: todayDate, status: salaryForm.status } : s))
        setEditSalaryId(null)
        toast({ title: 'Salary Record Updated' })
      } else {
        const newId = Date.now().toString()
        const newSal = {
          id: newId,
          employee: salaryForm.employee,
          role: salaryForm.role,
          baseSalary: baseSal,
          bonus: bonusAmt,
          date: todayDate,
          status: salaryForm.status
        }
        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('salaries').insert([{
            id: newId,
            employee: salaryForm.employee,
            role: salaryForm.role,
            base_salary: baseSal,
            bonus: bonusAmt,
            date: todayDate,
            status: salaryForm.status
          }])
          if (error) {
            toast({ title: 'Error adding salary record', description: error.message, variant: 'destructive' })
            return
          }
        }
        setSalaries([...salaries, newSal])
        toast({ title: 'Salary Record Added' })
      }
      setShowSalaryAdd(false)
      setSalaryForm({ employee: '', role: 'Employee', baseSalary: '', bonus: '', status: 'pending' })
    } catch (err: any) {
      toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Tracking</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage revenues, expenses, and payroll in one place.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditExpenseId(null); setExpenseForm({ title: '', category: 'Operations', amount: '', taxAmount: '', date: new Date().toISOString().slice(0,10), status: 'pending' }); setShowExpenseAdd(true) }} className="gap-1.5"><Plus className="h-4 w-4" /> Add Expense</Button>
          <Button variant="gold" size="sm" onClick={() => { setEditSalaryId(null); setSalaryForm({ employee: '', role: 'Employee', baseSalary: '', bonus: '', status: 'pending' }); setShowSalaryAdd(true) }} className="gap-1.5"><Plus className="h-4 w-4" /> Process Payroll</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-2xl font-bold mt-1 text-emerald-400">{formatCurrency(currentRevenue)}</p>
              </div>
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><TrendingUp className="h-4 w-4" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Expenses</p>
                <p className="text-2xl font-bold mt-1 text-red-400">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><TrendingDown className="h-4 w-4" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Payroll Total</p>
                <p className="text-2xl font-bold mt-1 text-blue-400">{formatCurrency(totalSalaries)}</p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Users className="h-4 w-4" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gold/5 border-gold/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Net Income</p>
                <div className="flex items-end gap-2 mt-1">
                  <p className="text-2xl font-bold text-gold">{formatCurrency(netIncome)}</p>
                  <Badge variant="outline" className={`text-[10px] ${Number(profitMargin) >= 0 ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' : 'text-red-400 border-red-400/20 bg-red-400/10'}`}>{profitMargin}% margin</Badge>
                </div>
              </div>
              <div className="p-2 bg-gold/20 rounded-lg text-gold"><Wallet className="h-4 w-4" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {[...expenses, ...salaries.map(s => ({...s, title: `Salary: ${s.employee}`, amount: s.baseSalary + s.bonus}))]
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((t: any, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-500/10 text-red-400">
                      <ArrowDownRight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">-{formatCurrency(Number(t.amount) + Number(t.tax_amount || 0))}</p>
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="h-[250px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No expenses found.</div>
            )}
            <div className="space-y-2 mt-4">
              {categoryData.map((c, i) => (
                <div key={c.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{c.name}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="lg:col-span-2">
          <Tabs defaultValue="expenses">
        <TabsList className="mb-4">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="salaries">Payroll & Salaries</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {expenses.length === 0 && <div className="p-8 text-center text-muted-foreground">No expenses recorded yet.</div>}
                {expenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div>
                      <p className="font-semibold">{e.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                        <Badge variant={e.status === 'paid' ? 'success' : 'secondary'} className="text-[10px] capitalize">{e.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-red-400">-{formatCurrency(Number(e.amount) + Number(e.tax_amount || 0))}</p>
                        {Number(e.tax_amount) > 0 && <p className="text-[10px] text-muted-foreground">Includes {formatCurrency(e.tax_amount)} tax</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-400" onClick={() => { setExpenseForm({ title: e.title, category: e.category, amount: String(e.amount), taxAmount: String(e.tax_amount || ''), date: e.date, status: e.status }); setEditExpenseId(e.id); setShowExpenseAdd(true) }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-400" onClick={() => setDeleteExpense(e.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="salaries">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {salaries.length === 0 && <div className="p-8 text-center text-muted-foreground">No payroll records yet.</div>}
                {salaries.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div>
                      <p className="font-semibold">{s.employee}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{s.role}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(s.date)}</span>
                        <Badge variant={s.status === 'paid' ? 'success' : 'secondary'} className="text-[10px] capitalize">{s.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-blue-400">-{formatCurrency(s.baseSalary + s.bonus)}</p>
                        {s.bonus > 0 && <p className="text-[10px] text-muted-foreground">Includes {formatCurrency(s.bonus)} bonus</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-400" onClick={() => { setSalaryForm({ employee: s.employee, role: s.role, baseSalary: String(s.baseSalary), bonus: String(s.bonus || 0), status: s.status }); setEditSalaryId(s.id); setShowSalaryAdd(true) }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-400" onClick={() => setDeleteSalary(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </div>

      {/* Dialogs for Adding/Editing */}
      <Dialog open={showExpenseAdd} onOpenChange={(open) => { if (!submitting) { setShowExpenseAdd(open); if(!open) setEditExpenseId(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editExpenseId ? 'Edit Expense' : 'Add New Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Title *</Label><Input placeholder="e.g. AWS Hosting" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} disabled={submitting} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Category</Label><Select value={expenseForm.category} onValueChange={v => setExpenseForm({...expenseForm, category: v})} disabled={submitting}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Infrastructure', 'Operations', 'Marketing', 'Software', 'Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Amount (₹) *</Label><Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} disabled={submitting} /></div>
              <div className="space-y-1"><Label>Tax/GST (₹)</Label><Input type="number" value={expenseForm.taxAmount} onChange={e => setExpenseForm({...expenseForm, taxAmount: e.target.value})} disabled={submitting} /></div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} disabled={submitting} /></div>
              <div className="col-span-2 space-y-1"><Label>Status</Label><Select value={expenseForm.status} onValueChange={v => setExpenseForm({...expenseForm, status: v})} disabled={submitting}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseAdd(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleAddExpense} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSalaryAdd} onOpenChange={(open) => { if (!submitting) { setShowSalaryAdd(open); if(!open) setEditSalaryId(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSalaryId ? 'Edit Payroll / Salary' : 'Process Payroll / Salary'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Employee Name *</Label><Input placeholder="e.g. Devon Shah" value={salaryForm.employee} onChange={e => setSalaryForm({...salaryForm, employee: e.target.value})} disabled={submitting} /></div>
              <div className="space-y-1"><Label>Role</Label><Select value={salaryForm.role} onValueChange={v => setSalaryForm({...salaryForm, role: v})} disabled={submitting}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{['Founder','Co-Founder','CEO','CTO','COO','CFO','Project Manager','Team Lead','Senior Developer','Developer','Frontend Developer','Backend Developer','Full Stack Developer','UI/UX Designer','Graphic Designer','Digital Marketer','SEO Specialist','Content Writer','Sales Executive','Business Development Manager','Account Manager','HR Manager','Admin','Operations Manager','Finance Manager','Customer Support','Intern'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Base Salary (₹) *</Label><Input type="number" value={salaryForm.baseSalary} onChange={e => setSalaryForm({...salaryForm, baseSalary: e.target.value})} disabled={submitting} /></div>
              <div className="space-y-1"><Label>Bonus / Perks (₹)</Label><Input type="number" value={salaryForm.bonus} onChange={e => setSalaryForm({...salaryForm, bonus: e.target.value})} disabled={submitting} /></div>
              <div className="space-y-1"><Label>Status</Label><Select value={salaryForm.status} onValueChange={v => setSalaryForm({...salaryForm, status: v})} disabled={submitting}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryAdd(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleAddSalary} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!deleteExpense} onOpenChange={(open) => { if (!open && !deleting) setDeleteExpense(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently remove the expense record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" disabled={deleting} onClick={async (e) => {
              e.preventDefault()
              if (isSupabaseConfigured() && deleteExpense) {
                setDeleting(true)
                try {
                  const { error } = await supabase.from('expenses').delete().eq('id', deleteExpense)
                  if (error) {
                    toast({ title: 'Error deleting expense', description: error.message, variant: 'destructive' })
                    return
                  }
                } catch (err: any) {
                  toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
                  return
                } finally {
                  setDeleting(false)
                }
              }
              setExpenses(expenses.filter(e => e.id !== deleteExpense))
              setDeleteExpense(null)
              toast({ title: 'Expense Deleted' })
            }}>
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Expense'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSalary} onOpenChange={(open) => { if (!open && !deleting) setDeleteSalary(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Record?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently remove the salary record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" disabled={deleting} onClick={async (e) => {
              e.preventDefault()
              if (isSupabaseConfigured() && deleteSalary) {
                setDeleting(true)
                try {
                  const { error } = await supabase.from('salaries').delete().eq('id', deleteSalary)
                  if (error) {
                    toast({ title: 'Error deleting salary record', description: error.message, variant: 'destructive' })
                    return
                  }
                } catch (err: any) {
                  toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
                  return
                } finally {
                  setDeleting(false)
                }
              }
              setSalaries(salaries.filter(s => s.id !== deleteSalary))
              setDeleteSalary(null)
              toast({ title: 'Salary Record Deleted' })
            }}>
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
