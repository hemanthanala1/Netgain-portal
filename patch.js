const fs = require('fs')
const path = require('path')

const file = path.join('app', '(dashboard)', 'documents', 'agreements', 'page.tsx')
let content = fs.readFileSync(file, 'utf8')

// 1. Add imports
content = content.replace(
  "import { LineItemsTable } from '@/components/ui/line-items-table'",
  "import { LineItemsTable } from '@/components/ui/line-items-table'\nimport { TemplateSelector, type TemplateId } from '@/components/ui/template-selector'\nimport { LivePreviewPanel } from '@/components/ui/live-preview-panel'"
)

// 2. Add states
content = content.replace(
  "const [previewLoading, setPreviewLoading] = useState(false)",
  "const [previewLoading, setPreviewLoading] = useState(false)\n  const [templateId, setTemplateId] = useState<TemplateId>('modern')\n  const [showPreviewPanel, setShowPreviewPanel] = useState(false)\n  useEffect(() => {\n    if (companyDocs?.defaultTemplateId) {\n      setTemplateId(companyDocs.defaultTemplateId)\n    }\n  }, [companyDocs])"
)

// 3. Update payload
content = content.replace(
  "docType: 'Agreement',",
  "docType: 'Agreement',\n      templateId,"
)

// 4. Update onClose
content = content.replace(
  "onClose={() => { setShowCreate(false); setForm(blank()) }}",
  "onClose={() => { setShowCreate(false); setForm(blank()); setShowPreviewPanel(false); }}"
)

// 5. Update footer
content = content.replace(
  "description=\"Configure client details, agreement type, duration, services covered, and legal clauses.\"\n        widthClass=\"max-w-2xl\"\n        footer={\n          <>\n            <Button variant=\"outline\" size=\"sm\" onClick={() => { setShowCreate(false); setForm(blank()) }}>Cancel</Button>",
  "description=\"Choose a template, configure client details, agreement type, duration, services covered, and legal clauses.\"\n        widthClass=\"max-w-7xl\"\n        footer={\n          <>\n            <Button variant=\"outline\" size=\"sm\" onClick={() => setShowPreviewPanel(v => !v)} className=\"gap-1.5 mr-auto\">\n              <Eye className=\"h-3.5 w-3.5\" />\n              {showPreviewPanel ? 'Hide Preview' : 'Show Preview'}\n            </Button>\n            <Button variant=\"outline\" size=\"sm\" onClick={() => { setShowCreate(false); setForm(blank()) }}>Cancel</Button>"
)

// 6. Wrap content in split layout
const startStr = '          <div className="space-y-5 py-2">'
const replacementStart =         <div className={showPreviewPanel ? 'grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 h-full' : ''}>
          {/* Left: Form */}
          <div className="overflow-auto">
            {/* Template Selector */}
            <div className="mb-5 pb-5 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-gold mb-3">Document Template</p>
              <TemplateSelector
                value={templateId}
                onChange={setTemplateId}
                onPreview={async (id) => {
                  let sub = Number(form.value) || 0
                  let tot = Number(form.value) || 0
                  let servicesStr = form.services || ''
                  if (form.items && form.items.length > 0) {
                    sub = form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
                    const lineDisc = form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
                    const lineTax = form.items.reduce((sum: number, item: any) => sum + Math.round(((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)), 0)
                    tot = (sub - lineDisc) + lineTax
                    servicesStr = form.items.map((i: any) => i.service_name).join(', ')
                  }

                  const previewPayload = {
                    docType: 'Agreement' as const,
                    templateId: id,
                    clientName: form.contact || form.client || 'Preview Client',
                    projectTitle: 'Agreement Preview',
                    companyName: form.client || 'Preview Company',
                    clientInfo: { business: form.type },
                    content: buildContent({ ...form, value: tot }, form.client, tot, servicesStr),
                  }
                  setPreviewDoc({ ...form, docId: 'PREVIEW', id: 'preview' } as any)
                  setPreviewLoading(true)
                  setPreviewBlobUrl(null)
                  try {
                    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewPayload) })
                    if (res.ok) {
                      const blob = await res.blob()
                      setPreviewBlobUrl(URL.createObjectURL(blob))
                    }
                  } catch {}
                  finally { setPreviewLoading(false) }
                }}
              />
            </div>
          <div className="space-y-5 py-2">
content = content.replace(startStr, replacementStart)

const endStr =               </div>
            </div>
          </div>
      </Drawer>

const replacementEnd =               </div>
            </div>
          </div>
          </div>
          {/* Right: Live Preview */}
          {showPreviewPanel && (
            <div className="hidden lg:block h-full min-h-[600px]">
              <LivePreviewPanel
                payload={form.client ? (() => {
                  let sub = Number(form.value) || 0
                  let tot = Number(form.value) || 0
                  let servicesStr = form.services || ''
                  if (form.items && form.items.length > 0) {
                    sub = form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
                    const lineDisc = form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
                    const lineTax = form.items.reduce((sum: number, item: any) => sum + Math.round(((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)), 0)
                    tot = (sub - lineDisc) + lineTax
                    servicesStr = form.items.map((i: any) => i.service_name).join(', ')
                  }
                  return {
                    docType: 'Agreement',
                    templateId,
                    clientName: form.contact || form.client,
                    projectTitle: \\ — \\,
                    companyName: form.client,
                    clientInfo: { business: form.type, mobile: form.phone },
                    content: buildContent({ ...form, value: tot }, form.client, tot, servicesStr),
                  }
                })() : null}
                visible
              />
            </div>
          )}
        </div>
      </Drawer>
content = content.replace(endStr, replacementEnd)

fs.writeFileSync(file, content)
console.log('Patched agreements/page.tsx successfully')
