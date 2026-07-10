import sys
path = r'c:\Users\heman\Downloads\Netgain Operating Portal\netgain-portal\app\(dashboard)\projects\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

assignee_jsx = '''
<div className="space-y-1">
  <label className="text-[10px] text-muted-foreground uppercase font-semibold">Assignee</label>
  <Select value={VALUE_VAR} onValueChange={SETTER_VAR}>
    <SelectTrigger className="h-8 text-xs bg-black/20 border-border"><SelectValue placeholder="Unassigned" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="none">Unassigned</SelectItem>
      {teamMembersList.map((tm: any) => (
        (!canSelfAssign && user?.name === tm.name) ? null : <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
'''

# Quick Create Project Form
quick_assignee = assignee_jsx.replace('VALUE_VAR', 'quickAssigneeId').replace('SETTER_VAR', 'setQuickAssigneeId')
if 'setQuickAssigneeId' not in content.split('placeholder="Search project managers..."')[1][:500]:
    content = content.replace(
        '<ProjectManagerAutocomplete',
        '<div className="flex flex-col space-y-3">\n              <ProjectManagerAutocomplete'
    )
    content = content.replace(
        'placeholder="Search project managers..."\n            />\n          </div>',
        'placeholder="Search project managers..."\n            />\n            ' + quick_assignee + '\n          </div>\n          </div>'
    )

# Risk Form
risk_assignee = assignee_jsx.replace('VALUE_VAR', 'newRiskAssignee').replace('SETTER_VAR', 'setNewRiskAssignee')
if 'setNewRiskAssignee' not in content.split('<SelectItem value="critical">Critical</SelectItem>')[1][:500]:
    content = content.replace('<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">', '<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">')
    content = content.replace(
        '</Select>\n                        </div>\n                      </div>\n                      <div className="space-y-1">',
        '</Select>\n                        </div>\n                        ' + risk_assignee + '\n                      </div>\n                      <div className="space-y-1">'
    )

# Dependency Form
dep_assignee = assignee_jsx.replace('VALUE_VAR', 'newDepAssignee').replace('SETTER_VAR', 'setNewDepAssignee')
if 'setNewDepAssignee' not in content.split('<SelectItem value="high">High (Critical path)</SelectItem>')[1][:500]:
    content = content.replace('<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">', '<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">', 1)
    content = content.replace(
        '</Select>\n                        </div>\n                      </div>\n                      <div className="space-y-1">\n                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Dependency Details</label>',
        '</Select>\n                        </div>\n                        ' + dep_assignee + '\n                      </div>\n                      <div className="space-y-1">\n                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Dependency Details</label>'
    )

# Notes Form
note_assignee = assignee_jsx.replace('VALUE_VAR', 'newNoteAssignee').replace('SETTER_VAR', 'setNewNoteAssignee')
if 'setNewNoteAssignee' not in content.split('id={`note-text-${detailProject.id}`}')[1][:500]:
    content = content.replace(
        '<div className="flex justify-end">',
        '<div className="flex justify-between items-center">\n                          ' + note_assignee + '\n                        <div className="flex justify-end">'
    )
    content = content.replace(
        'onClick={() => handleAddNote(detailProject.id)}>\n                          Save Note\n                        </Button>\n                      </div>',
        'onClick={() => handleAddNote(detailProject.id)}>\n                          Save Note\n                        </Button>\n                      </div>\n                      </div>'
    )

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
