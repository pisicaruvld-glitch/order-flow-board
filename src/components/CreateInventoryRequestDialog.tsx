import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createInventoryRequest, type CreateInventoryRequestPayload } from "@/lib/inventoryApi";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onCreated: () => void;
}

export function CreateInventoryRequestDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState<CreateInventoryRequestPayload>({
    material: "",
    material_description: "",
    plant: "",
    sloc: "",
    request_reason: "",
    priority: "NORMAL",
    comment: "",
  });

  const set = (field: keyof CreateInventoryRequestPayload, val: string) =>
    setForm((p) => ({ ...p, [field]: val }));

  const handleSubmit = async () => {
    if (!form.material.trim()) {
      toast({ title: "Material is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await createInventoryRequest(form);
      toast({ title: "Stock check request created" });
      setOpen(false);
      setForm({ material: "", material_description: "", plant: "", sloc: "", request_reason: "", priority: "NORMAL", comment: "" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Error creating request", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus size={14} /> New Stock Check
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Stock Check Request</DialogTitle>
          <DialogDescription>Create a request for warehouse stock verification</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Material *</Label>
              <Input value={form.material} onChange={(e) => set("material", e.target.value)} placeholder="e.g. 100234" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.material_description ?? ""} onChange={(e) => set("material_description", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Plant</Label>
              <Input value={form.plant ?? ""} onChange={(e) => set("plant", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>SLoc</Label>
              <Input value={form.sloc ?? ""} onChange={(e) => set("sloc", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={form.request_reason ?? ""} onChange={(e) => set("request_reason", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Comment</Label>
            <Textarea value={form.comment ?? ""} onChange={(e) => set("comment", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
