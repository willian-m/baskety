.PHONY: dashboard

# Open the implementation progress dashboard in your browser.
#
# Running on a remote VM? SSH tunnel first:
#   ssh -L 9000:localhost:9000 user@vm
# Then on the VM run:
#   make dashboard
# Then open: http://localhost:9000/dashboard.html
dashboard:
	@echo "Dashboard: http://localhost:9000/dashboard.html"
	@echo "Remote VM? Run this on your local machine first:"
	@echo "  ssh -L 9000:localhost:9000 user@vm"
	@echo ""
	python3 -m http.server 9000 --directory docs/superpowers/
